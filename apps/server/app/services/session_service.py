"""
Session service — bridges the decision engine, WebSocket manager, and skill API.
"""

from __future__ import annotations

import asyncio

from app.engine.engine import DecisionEngine
from app.engine.events import EngineEvent
from app.websocket.manager import ConnectionManager


class SessionService:
    def __init__(self) -> None:
        self.engine = DecisionEngine()
        self.ws_manager = ConnectionManager()

        # Queues for skill polling: session_id -> queue of player events
        self._player_events: dict[str, asyncio.Queue] = {}
        # Track which option the player selected (before reasoning is submitted)
        self._pending_options: dict[str, str] = {}

    # ─── Session lifecycle ───

    def create_session(self, project: str | None = None) -> tuple[str, EngineEvent]:
        session, event = self.engine.create_session(project)
        self._player_events[session.session_id] = asyncio.Queue()
        return session.session_id, event

    def list_sessions(self) -> list[dict]:
        return [
            {
                "session_id": s.session_id,
                "project": s.project,
                "phase": s.phase.value,
                "node_count": s.graph.node_count,
            }
            for s in self.engine.sessions.values()
        ]

    def get_session_info(self, session_id: str) -> dict | None:
        session = self.engine.get_session(session_id)
        if not session:
            return None
        return {
            "session_id": session.session_id,
            "project": session.project,
            "phase": session.phase.value,
            "graph": session.graph.to_dict(),
            "completed_areas": list(session.completed_areas),
        }

    # ─── Player events (game → skill) ───

    async def enqueue_player_event(self, session_id: str, event: dict) -> None:
        """Game client action → enqueue for skill to pick up."""
        queue = self._player_events.get(session_id)
        if queue:
            await queue.put(event)

    async def get_pending_player_event(self, session_id: str | None) -> dict | None:
        """Skill polls: return next player event or None."""
        if session_id is None:
            # Return from any session
            for q in self._player_events.values():
                if not q.empty():
                    return q.get_nowait()
            return None

        queue = self._player_events.get(session_id)
        if queue and not queue.empty():
            return queue.get_nowait()
        return None

    async def wait_for_player_event(
        self, session_id: str | None, timeout: int = 30
    ) -> dict | None:
        """Long-poll: block until a player event arrives or timeout."""
        if session_id is None:
            # For simplicity, pick the first session with a queue
            for sid, q in self._player_events.items():
                try:
                    return await asyncio.wait_for(q.get(), timeout=timeout)
                except asyncio.TimeoutError:
                    return None
            return None

        queue = self._player_events.get(session_id)
        if not queue:
            return None
        try:
            return await asyncio.wait_for(queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    # ─── Game WebSocket message handling ───

    async def handle_game_message(self, session_id: str, msg: dict) -> None:
        """Process a message from the game client."""
        session = self.engine.get_session(session_id)
        if not session:
            await self.ws_manager.send_to_session(
                session_id,
                {"type": "ERROR", "message": "Session not found"},
            )
            return

        msg_type = msg.get("type")

        if msg_type == "ENTER_AREA":
            area_id = msg["areaId"]
            self.engine.enter_area(session, area_id)
            # Notify skill that player entered an area
            await self.enqueue_player_event(session_id, {
                "type": "ENTER_AREA",
                "areaId": area_id,
                "sessionId": session_id,
            })

        elif msg_type == "SELECT_OPTION":
            node_id = msg["nodeId"]
            option_id = msg["optionId"]
            # Store pending option, ask for reasoning
            self._pending_options[node_id] = option_id
            event = self.engine.select_option(session, node_id, option_id)
            await self.ws_manager.send_to_session(
                session_id, event.to_ws_message()
            )

        elif msg_type == "SUBMIT_REASONING":
            node_id = msg["nodeId"]
            text = msg["text"]
            option_id = self._pending_options.pop(node_id, "")
            self.engine.submit_reasoning(session, node_id, option_id, text)
            # Notify skill with the reasoning
            await self.enqueue_player_event(session_id, {
                "type": "REASONING_SUBMITTED",
                "nodeId": node_id,
                "optionId": option_id,
                "reasoning": text,
                "sessionId": session_id,
            })

        elif msg_type == "RESPOND_TO_CHALLENGE":
            node_id = msg["nodeId"]
            text = msg["text"]
            # Forward to skill
            await self.enqueue_player_event(session_id, {
                "type": "CHALLENGE_RESPONSE",
                "nodeId": node_id,
                "response": text,
                "sessionId": session_id,
            })

        elif msg_type == "CONTINUE":
            self.engine.continue_exploring(session)

        elif msg_type == "RECONSIDER":
            node_id = msg["nodeId"]
            event = self.engine.reconsider(session, node_id)
            # Notify skill
            await self.enqueue_player_event(session_id, {
                "type": "RECONSIDER",
                "nodeId": node_id,
                "sessionId": session_id,
            })

    # ─── Skill → Game (pushed via WebSocket) ───

    async def skill_create_decision(
        self,
        session_id: str,
        area_id: str,
        question: str,
        options: list[dict],
    ) -> None:
        session = self.engine.get_session(session_id)
        if not session:
            return

        event = self.engine.create_decision(session, area_id, question, options)
        await self.ws_manager.send_to_session(session_id, event.to_ws_message())

    async def skill_send_challenge(
        self, session_id: str, node_id: str, question: str
    ) -> None:
        session = self.engine.get_session(session_id)
        if not session:
            return

        event = self.engine.receive_challenge(session, node_id, question)
        await self.ws_manager.send_to_session(session_id, event.to_ws_message())

    async def skill_send_evaluation(
        self, session_id: str, node_id: str, feedback: str, consequence: str
    ) -> None:
        session = self.engine.get_session(session_id)
        if not session:
            return

        event = self.engine.receive_evaluation(session, node_id, feedback, consequence)
        await self.ws_manager.send_to_session(session_id, event.to_ws_message())


# Singleton instance
session_service = SessionService()
