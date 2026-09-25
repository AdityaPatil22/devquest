"""
Core decision engine — orchestrates the grilling loop.
Pure logic, no web framework dependencies.
"""

from __future__ import annotations

import uuid

from app.engine.decision_graph import DecisionGraph, Option, Recommendation
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
            data={"sessionId": session_id},
        )
        return session, event

    def get_session(self, session_id: str) -> Session | None:
        return self.sessions.get(session_id)

    def submit_problem(self, session: Session, problem: str) -> None:
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
    ) -> EngineEvent:
        """Skill provides a decision question."""
        opts = [Option(id=o["id"], label=o["label"]) for o in options]
        rec = (
            Recommendation(option=recommendation["option"], why=recommendation["why"])
            if recommendation
            else None
        )

        session.advance_round()
        node = session.graph.add_node(
            question=question,
            options=opts,
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
                "options": [{"id": o.id, "label": o.label} for o in opts],
                "recommendation": (
                    {"option": rec.option, "why": rec.why} if rec else None
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
        """
        Record the player's option selection.

        Context is optional. Selecting an option must always advance
        the session to the challenge/evaluation flow, regardless of
        whether additional context was provided.
        """
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

        session.move_to_awaiting_challenge()

    def receive_challenge(
        self, session: Session, node_id: str, question: str
    ) -> EngineEvent:
        """Skill provides a challenge question."""
        session.graph.set_challenge(node_id, question)
        session.move_to_awaiting_defense()

        return EngineEvent(
            type=EventType.CHALLENGE,
            data={"nodeId": node_id, "question": question},
        )

    def submit_defense(
        self, session: Session, node_id: str, defense: str
    ) -> None:
        """Player defended their choice."""
        session.graph.set_defense(node_id, defense)
        session.move_to_awaiting_evaluation()

    def receive_evaluation(
        self,
        session: Session,
        node_id: str,
        feedback: str,
        consequence: str,
    ) -> EngineEvent:
        """Skill provides evaluation of the decision."""
        session.graph.evaluate(node_id, feedback, consequence)

        return EngineEvent(
            type=EventType.EVALUATION,
            data={
                "nodeId": node_id,
                "feedback": feedback,
                "consequence": consequence,
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
                "reconsideredCount": session.graph.reconsidered_count,
                "docContent": doc_content,
            },
    )

    def reconsider(self, session: Session, node_id: str) -> None:
        """Player wants to reconsider. Skill will provide new question."""
        session.current_node_id = node_id
        session.move_to_awaiting_question()
