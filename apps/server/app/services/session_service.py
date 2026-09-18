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
        self._player_events: dict[str, asyncio.Queue] = {}

    # ─── Session lifecycle ───

    def create_session(self) -> tuple[str, EngineEvent]:
        session, event = self.engine.create_session()
        self._player_events[session.session_id] = asyncio.Queue()
        return session.session_id, event

    def list_sessions(self) -> list[dict]:
        return [
            {
                "session_id": s.session_id,
                "problem": s.problem,
                "phase": s.phase.value,
                "round": s.current_round,
                "decided_count": s.graph.decided_count,
            }
            for s in self.engine.sessions.values()
        ]

    def get_session_info(self, session_id: str) -> dict | None:
        session = self.engine.get_session(session_id)
        if not session:
            return None
        return {
            "session_id": session.session_id,
            "problem": session.problem,
            "phase": session.phase.value,
            "round": session.current_round,
            "graph": session.graph.to_dict(),
        }

    # ─── Player events (game → skill) ───

    async def enqueue_player_event(self, session_id: str, event: dict) -> None:
        queue = self._player_events.get(session_id)
        if queue:
            await queue.put(event)

    async def get_pending_player_event(self, session_id: str | None) -> dict | None:
        if session_id is None:
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
        if session_id is None:
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
        session = self.engine.get_session(session_id)
        if not session:
            await self.ws_manager.send_to_session(
                session_id, {"type": "ERROR", "message": "Session not found"}
            )
            return

        msg_type = msg.get("type")

        if msg_type == "PROBLEM_SUBMITTED":
            problem = msg["problem"]
            self.engine.submit_problem(session, problem)
            await self.enqueue_player_event(session_id, {
                "type": "PROBLEM_SUBMITTED",
                "sessionId": session_id,
                "problem": problem,
            })

        elif msg_type == "OPTION_SELECTED":
            node_id = msg["nodeId"]
            option_id = msg["optionId"]
            context = msg.get("context")
            self.engine.select_option(session, node_id, option_id, context)
            await self.enqueue_player_event(session_id, {
                "type": "OPTION_SELECTED",
                "sessionId": session_id,
                "nodeId": node_id,
                "optionId": option_id,
                "context": context,
            })

        elif msg_type == "CHALLENGE_RESPONSE":
            node_id = msg["nodeId"]
            response = msg["response"]
            self.engine.submit_defense(session, node_id, response)
            await self.enqueue_player_event(session_id, {
                "type": "CHALLENGE_RESPONSE",
                "sessionId": session_id,
                "nodeId": node_id,
                "response": response,
            })

        elif msg_type == "RECONSIDER":
            node_id = msg["nodeId"]
            self.engine.reconsider(session, node_id)
            await self.enqueue_player_event(session_id, {
                "type": "RECONSIDER",
                "sessionId": session_id,
                "nodeId": node_id,
            })

        elif msg_type == "CONTINUE":
            pass  # No action needed — skill decides next step

    # ─── Skill → Game (pushed via WebSocket) ───

    async def skill_create_decision(
        self,
        session_id: str,
        question: str,
        options: list[dict],
        recommendation: dict | None = None,
        round_num: int = 1,
        depends_on: str | None = None,
    ) -> None:
        session = self.engine.get_session(session_id)
        if not session:
            return
        event = self.engine.create_decision(
            session, question, options, recommendation, round_num, depends_on
        )
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

    async def skill_finish(
        self, session_id: str, summary: str, doc_content: str
    ) -> None:
        session = self.engine.get_session(session_id)
        if not session:
            return
        event = self.engine.finish_session(session, summary, doc_content)
        await self.ws_manager.send_to_session(session_id, event.to_ws_message())


# Singleton
session_service = SessionService()
