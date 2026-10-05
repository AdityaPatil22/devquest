"""
Core decision engine — orchestrates the grilling loop.
Pure logic, no web framework dependencies.
"""

from __future__ import annotations

import uuid

from app.engine.decision_graph import (
    DecisionGraph,
    Option,
    Recommendation,
)
from app.engine.events import EngineEvent, EventType
from app.engine.session import Session, SessionPhase


class DecisionEngine:
    """Manages sessions and produces engine events."""

    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}

    def create_session(self) -> tuple[Session, EngineEvent]:
        session_id = str(uuid.uuid4())

        session = Session(session_id=session_id)

        session.start()

        self.sessions[session_id] = session

        event = EngineEvent(
            type=EventType.SESSION_STARTED,
            data={
                "sessionId": session_id,
            },
        )

        return session, event

    def get_session(
        self,
        session_id: str,
    ) -> Session | None:
        return self.sessions.get(session_id)

    def submit_problem(
        self,
        session: Session,
        problem: str,
    ) -> None:
        """Player submitted their problem statement at the Gate."""

        session.set_problem(problem)

    def create_decision(
        self,
        session: Session,
        question: str,
        options: list[dict],
        recommendation: dict | None = None,
        round_num: int = 1,
        depends_on: str | None = None,
        description: str = "",
    ) -> EngineEvent:
        if session.phase != SessionPhase.AWAITING_QUESTION:
            raise ValueError(
                f"Cannot create decision while session is in "
                f"phase '{session.phase.value}'"
            )

        next_round = session.current_round + 1

        if next_round > 7:
            raise ValueError("Maximum of 7 decision rounds has been reached")

        if round_num != next_round:
            raise ValueError(
                f"Invalid decision round '{round_num}'. Expected '{next_round}'"
            )

        opts = [
            Option(
                id=o["id"],
                label=o["label"],
                description=o.get("description", ""),
            )
            for o in options
        ]

        rec = (
            Recommendation(
                option=recommendation["option"],
                why=recommendation["why"],
                what_to_know=recommendation.get(
                    "what_to_know",
                    "",
                ),
            )
            if recommendation
            else None
        )

        session.advance_round()

        node = session.graph.add_node(
            question=question,
            options=opts,
            description=description,
            recommendation=rec,
            round=round_num or session.current_round,
            parent_id=session.current_node_id,
            depends_on=depends_on,
        )

        session.set_decision_node(node.id)

        return EngineEvent(
            type=EventType.DECISION_CREATED,
            data={
                "nodeId": node.id,
                "question": question,
                "description": description,
                "options": [
                    {
                        "id": option.id,
                        "label": option.label,
                        "description": option.description,
                    }
                    for option in opts
                ],
                "recommendation": (
                    {
                        "option": rec.option,
                        "why": rec.why,
                        "whatToKnow": rec.what_to_know,
                    }
                    if rec
                    else None
                ),
                "round": node.round,
                "dependsOn": depends_on,
            },
        )

    def select_option(
        self,
        session: Session,
        node_id: str,
        option_id: str,
        context: str | None = None,
    ) -> None:
        if session.phase != SessionPhase.AWAITING_SELECTION:
            raise ValueError(
                f"Cannot select an option while session is in "
                f"phase '{session.phase.value}'"
            )

        if session.current_node_id != node_id:
            raise ValueError(
                f"Node '{node_id}' is not the current decision"
            )

        normalized_context = (
            context.strip()
            if isinstance(context, str) and context.strip()
            else None
        )

        session.graph.choose(
            node_id,
            option_id,
            normalized_context,
        )

        session.move_to_awaiting_question()

    def start_document_generation(
        self,
        session: Session,
    ) -> EngineEvent:
        if session.phase == SessionPhase.DOCUMENT_GENERATING:
            return EngineEvent(
                type=EventType.FINAL_DOCUMENT_GENERATING,
                data={
                    "message": (
                        "Claude has all the context it needs and is generating "
                        "your final implementation plan..."
                    ),
                },
            )

        if session.phase != SessionPhase.AWAITING_QUESTION:
            raise ValueError(
                f"Cannot start document generation while session is in "
                f"phase '{session.phase.value}'"
            )

        session.start_document_generation()

        return EngineEvent(
            type=EventType.FINAL_DOCUMENT_GENERATING,
            data={
                "message": (
                    "Claude has all the context it needs and is generating "
                    "your final implementation plan..."
                ),
            },
        )

    def finish_session(
        self,
        session: Session,
        summary: str,
        doc_content: str,
    ) -> EngineEvent:
        """Skill says the session is complete."""

        session.finish(
            summary,
            doc_content,
        )

        return EngineEvent(
            type=EventType.SESSION_COMPLETE,
            data={
                "summary": summary,
                "decisionsCount": session.graph.decided_count,
                "docContent": doc_content,
            },
        )