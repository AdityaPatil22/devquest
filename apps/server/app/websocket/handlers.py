"""WebSocket endpoint handler for the game client."""

from __future__ import annotations

import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.services.session_service import session_service

logger = logging.getLogger(__name__)


async def websocket_endpoint(ws: WebSocket) -> None:
    """Handle a game client WebSocket connection.

    Supports reconnection: if the query string contains ``session_id``
    and that session still exists, the WebSocket is associated with the
    existing session instead of creating a new one.  Any messages that
    were queued while the session had no active connections are replayed
    immediately.
    """
    requested_sid = ws.query_params.get("session_id")

    if requested_sid and session_service.engine.get_session(requested_sid):
        # Rejoin existing session
        session_id = requested_sid
        logger.info("WS rejoining session %s", session_id)
        await session_service.ws_manager.connect(session_id, ws)

        session = session_service.engine.get_session(session_id)
        await ws.send_json({
            "type": "SESSION_RESUMED",
            "sessionId": session_id,
            "phase": session.phase.value,
            "round": session.current_round,
        })

        # Replay any messages that were queued while disconnected
        await session_service.ws_manager.replay_pending(session_id, ws)
    else:
        # Brand-new session
        session_id, start_event = session_service.create_session()
        logger.info("WS created new session %s", session_id)
        await session_service.ws_manager.connect(session_id, ws)
        await ws.send_json(start_event.to_ws_message())

    try:
        while True:
            data = await ws.receive_json()
            await session_service.handle_game_message(session_id, data)

    except WebSocketDisconnect:
        logger.info("WS disconnected from session %s", session_id)
    except Exception as e:
        try:
            await ws.send_json({"type": "ERROR", "message": str(e)})
        except Exception:
            pass
    finally:
        session_service.ws_manager.disconnect(session_id, ws)
