"""WebSocket endpoint handler for the game client."""

from __future__ import annotations

import logging

from fastapi import (
    WebSocket,
    WebSocketDisconnect,
)

from app.services.session_service import (
    session_service,
)

logger = logging.getLogger(__name__)


def build_session_snapshot(
    session,
) -> dict:
    """
    Build the complete authoritative state that the
    browser needs to reconstruct the game after reload.
    """

    graph = session.graph.to_dict()

    return {
        "sessionId": session.session_id,
        "problem": session.problem,
        "phase": session.phase.value,
        "round": session.current_round,
        "currentNodeId": (
            session.current_node_id
        ),
        "decisions": graph["nodes"],
        "world": session.world,
        "player": session.player,
        "summary": session.summary,
        "docContent": session.doc_content,
    }


async def websocket_endpoint(
    ws: WebSocket,
) -> None:
    """
    Handle the game WebSocket.

    Existing sessions are resumed using the session_id
    stored by the browser.
    """

    requested_sid = (
        ws.query_params.get(
            "session_id"
        )
    )

    existing_session = None

    if requested_sid:
        existing_session = (
            session_service.engine.get_session(
                requested_sid
            )
        )

    # ─────────────────────────────────────────
    # Resume existing session
    # ─────────────────────────────────────────

    if existing_session:
        session_id = requested_sid

        logger.info(
            "WS rejoining session %s",
            session_id,
        )

        await session_service.ws_manager.connect(
            session_id,
            ws,
        )

        snapshot = build_session_snapshot(
            existing_session,
        )

        await ws.send_json(
            {
                "type": "SESSION_RESUMED",
                "sessionId": session_id,
                "phase": (
                    existing_session.phase.value
                ),
                "round": (
                    existing_session.current_round
                ),
                "snapshot": snapshot,
            }
        )

        # Replay messages that arrived while the
        # browser was disconnected.
        await session_service.ws_manager.replay_pending(
            session_id,
            ws,
        )

    # ─────────────────────────────────────────
    # Create new session
    # ─────────────────────────────────────────

    else:
        session_id, start_event = (
            session_service.create_session()
        )

        logger.info(
            "WS created new session %s",
            session_id,
        )

        await session_service.ws_manager.connect(
            session_id,
            ws,
        )

        await ws.send_json(
            start_event.to_ws_message()
        )

    # ─────────────────────────────────────────
    # Main WebSocket loop
    # ─────────────────────────────────────────

    try:
        while True:
            data = await ws.receive_json()

            await session_service.handle_game_message(
                session_id,
                data,
            )

    except WebSocketDisconnect:
        logger.info(
            "WS disconnected from session %s",
            session_id,
        )

    except Exception as error:
        logger.exception(
            "WS error for session %s",
            session_id,
        )

        try:
            await ws.send_json(
                {
                    "type": "ERROR",
                    "message": str(error),
                }
            )
        except Exception:
            pass

    finally:
        session_service.ws_manager.disconnect(
            session_id,
            ws,
        )