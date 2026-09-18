"""Session state machine — tracks the phase of a game session."""

from __future__ import annotations

from enum import Enum

from app.engine.decision_graph import DecisionGraph


class SessionPhase(str, Enum):
    IDLE = "idle"
    EXPLORING = "exploring"
    DECISION = "decision"
    AWAITING_REASONING = "awaiting_reasoning"
    CHALLENGING = "challenging"
    EVALUATING = "evaluating"
    COMPLETE = "complete"


class Session:
    def __init__(self, session_id: str, project: str | None = None) -> None:
        self.session_id = session_id
        self.project = project
        self.phase = SessionPhase.IDLE
        self.graph = DecisionGraph()
        self.current_node_id: str | None = None
        self.current_area_id: str | None = None
        self.completed_areas: set[str] = set()

    def start(self) -> None:
        self.phase = SessionPhase.EXPLORING

    def enter_area(self, area_id: str) -> None:
        self.current_area_id = area_id
        self.phase = SessionPhase.DECISION

    def set_decision_node(self, node_id: str) -> None:
        self.current_node_id = node_id

    def move_to_reasoning(self) -> None:
        self.phase = SessionPhase.AWAITING_REASONING

    def move_to_challenging(self) -> None:
        self.phase = SessionPhase.CHALLENGING

    def move_to_evaluating(self) -> None:
        self.phase = SessionPhase.EVALUATING

    def complete_area(self, area_id: str) -> None:
        self.completed_areas.add(area_id)
        self.current_area_id = None
        self.current_node_id = None
        self.phase = SessionPhase.EXPLORING

    def finish(self) -> None:
        self.phase = SessionPhase.COMPLETE

    def back_to_exploring(self) -> None:
        self.current_node_id = None
        self.current_area_id = None
        self.phase = SessionPhase.EXPLORING
