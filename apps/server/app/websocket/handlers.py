"""WebSocket endpoint handler for the game client."""

from __future__ import annotations

from fastapi import WebSocket, WebSocketDisconnect

from app.services.session_service import session_service


async def websocket_endpoint(ws: WebSocket) -> None:
    """Handle a game client WebSocket connection."""
    # Create a new session for this connection
    session_id, start_event = session_service.create_session()

    await session_service.ws_manager.connect(session_id, ws)

    try:
        # Send session started message
        await ws.send_json(start_event.to_ws_message())

        while True:
            data = await ws.receive_json()
            await session_service.handle_game_message(session_id, data)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "ERROR", "message": str(e)})
        except Exception:
            pass
    finally:
        session_service.ws_manager.disconnect(session_id, ws)
