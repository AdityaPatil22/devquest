"""
Core decision engine — orchestrates the decision loop.
Pure logic, no web framework dependencies.
"""

from __future__ import annotations

import uuid

from app.engine.decision_graph import DecisionGraph, Option
from app.engine.events import EngineEvent, EventType
from app.engine.session import Session, SessionPhase


class DecisionEngine:
    """Manages sessions and produces engine events."""

    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}

    def create_session(self, project: str | None = None) -> tuple[Session, EngineEvent]:
        session_id = str(uuid.uuid4())
        session = Session(session_id=session_id, project=project)
        session.start()
        self.sessions[session_id] = session

        event = EngineEvent(
            type=EventType.SESSION_STARTED,
            data={"sessionId": session_id},
        )
        return session, event

    def get_session(self, session_id: str) -> Session | None:
        return self.sessions.get(session_id)

    def enter_area(self, session: Session, area_id: str) -> EngineEvent:
        """Player entered an interaction zone. Returns a pending event.
        The actual decision content comes from the skill (via API)
        or can be generated here in standalone mode."""
        session.enter_area(area_id)

        # Return a pending event — the decision content will be filled
        # by the skill via the /api/decisions endpoint
        return EngineEvent(
            type=EventType.DECISION_CREATED,
            data={
                "areaId": area_id,
                "status": "awaiting_skill",
            },
        )

    def create_decision(
        self,
        session: Session,
        area_id: str,
        question: str,
        options: list[dict],
    ) -> EngineEvent:
        """Skill provides a decision question for an area."""
        opts = [Option(id=o["id"], label=o["label"]) for o in options]
        node = session.graph.add_node(
            area_id=area_id,
            question=question,
            options=opts,
            parent_id=session.current_node_id,
        )
        session.set_decision_node(node.id)

        return EngineEvent(
            type=EventType.DECISION_CREATED,
            data={
                "nodeId": node.id,
                "question": question,
                "options": [{"id": o.id, "label": o.label} for o in opts],
            },
        )

    def select_option(
        self, session: Session, node_id: str, option_id: str
    ) -> EngineEvent:
        """Player selected an option. Ask for reasoning."""
        node = session.graph.get_node(node_id)
        if not node:
            return EngineEvent(type=EventType.ERROR, data={"message": "Node not found"})

        selected = next((o for o in node.options if o.id == option_id), None)
        if not selected:
            return EngineEvent(type=EventType.ERROR, data={"message": "Invalid option"})

        session.move_to_reasoning()

        return EngineEvent(
            type=EventType.REASONING_REQUESTED,
            data={
                "nodeId": node_id,
                "prompt": f"Why did you choose {selected.label}?",
            },
        )

    def submit_reasoning(
        self, session: Session, node_id: str, option_id: str, reasoning: str
    ) -> None:
        """Record the player's reasoning. The challenge comes from the skill."""
        session.graph.choose(node_id, option_id, reasoning)
        session.move_to_challenging()

    def receive_challenge(
        self, session: Session, node_id: str, question: str
    ) -> EngineEvent:
        """Skill provides a challenge question."""
        return EngineEvent(
            type=EventType.CHALLENGE,
            data={"nodeId": node_id, "question": question},
        )

    def receive_evaluation(
        self,
        session: Session,
        node_id: str,
        feedback: str,
        consequence: str,
    ) -> EngineEvent:
        """Skill provides evaluation of the decision."""
        session.graph.evaluate(node_id, feedback, consequence)
        session.move_to_evaluating()

        return EngineEvent(
            type=EventType.EVALUATION,
            data={
                "nodeId": node_id,
                "feedback": feedback,
                "consequence": consequence,
                "nextAction": "CONTINUE",
            },
        )

    def continue_exploring(self, session: Session) -> EngineEvent | None:
        """Player continues after evaluation."""
        if session.current_area_id:
            session.complete_area(session.current_area_id)
        else:
            session.back_to_exploring()
        return None

    def reconsider(self, session: Session, node_id: str) -> EngineEvent:
        """Player wants to reconsider a decision. Fork the graph."""
        node = session.graph.get_node(node_id)
        if not node:
            return EngineEvent(type=EventType.ERROR, data={"message": "Node not found"})

        # The skill will provide the new question via /api/decisions
        session.phase = SessionPhase.DECISION
        session.current_node_id = node_id

        return EngineEvent(
            type=EventType.DECISION_CREATED,
            data={
                "areaId": node.area_id,
                "nodeId": node_id,
                "status": "awaiting_skill_reconsider",
            },
        )
