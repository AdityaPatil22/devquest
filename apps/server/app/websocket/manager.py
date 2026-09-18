"""WebSocket connection manager with offline message queuing."""

from __future__ import annotations

import collections
import logging
from typing import Deque

from fastapi import WebSocket

logger = logging.getLogger(__name__)

MAX_PENDING_PER_SESSION = 50


class ConnectionManager:
    def __init__(self) -> None:
        # session_id -> list of connected WebSocket clients
        self._connections: dict[str, list[WebSocket]] = {}
        # Messages queued while a session has no active connections
        self._pending: dict[str, Deque[dict]] = {}

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        if session_id not in self._connections:
            self._connections[session_id] = []
        self._connections[session_id].append(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(session_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(session_id, None)

    async def send_to_session(self, session_id: str, message: dict) -> None:
        """Send a message to all clients connected to a session.

        If no clients are connected, the message is queued for replay
        when a client reconnects.
        """
        conns = self._connections.get(session_id, [])
        if not conns:
            logger.warning(
                "No WS connections for session %s — queuing %s",
                session_id,
                message.get("type", "?"),
            )
            queue = self._pending.setdefault(
                session_id, collections.deque(maxlen=MAX_PENDING_PER_SESSION)
            )
            queue.append(message)
            return

        disconnected = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(session_id, ws)

    async def replay_pending(self, session_id: str, ws: WebSocket) -> None:
        """Replay queued messages to a newly-reconnected client."""
        queue = self._pending.pop(session_id, None)
        if not queue:
            return
        logger.info("Replaying %d pending messages for session %s", len(queue), session_id)
        for msg in queue:
            try:
                await ws.send_json(msg)
            except Exception:
                break

    async def broadcast(self, message: dict) -> None:
        """Send to all connected clients across all sessions."""
        for session_id in list(self._connections.keys()):
            await self.send_to_session(session_id, message)
