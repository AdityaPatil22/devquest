"""WebSocket connection manager."""

from __future__ import annotations

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        # session_id -> list of connected WebSocket clients
        self._connections: dict[str, list[WebSocket]] = {}

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
        """Send a message to all clients connected to a session."""
        conns = self._connections.get(session_id, [])
        disconnected = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(session_id, ws)

    async def broadcast(self, message: dict) -> None:
        """Send to all connected clients across all sessions."""
        for session_id in list(self._connections.keys()):
            await self.send_to_session(session_id, message)
