"""Session state machine — tracks the phase of a grilling session."""

from __future__ import annotations

from enum import Enum

from app.engine.decision_graph import DecisionGraph


class SessionPhase(str, Enum):
    IDLE = "idle"
    AWAITING_PROBLEM = "awaiting_problem"
    AWAITING_QUESTION = "awaiting_question"
    AWAITING_SELECTION = "awaiting_selection"
    AWAITING_CHALLENGE = "awaiting_challenge"
    AWAITING_DEFENSE = "awaiting_defense"
    AWAITING_EVALUATION = "awaiting_evaluation"
    COMPLETE = "complete"


class Session:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.problem: str | None = None
        self.phase = SessionPhase.IDLE
        self.graph = DecisionGraph()
        self.current_node_id: str | None = None
        self.current_round = 0

    def start(self) -> None:
        self.phase = SessionPhase.AWAITING_PROBLEM

    def set_problem(self, problem: str) -> None:
        self.problem = problem
        self.phase = SessionPhase.AWAITING_QUESTION

    def set_decision_node(self, node_id: str) -> None:
        self.current_node_id = node_id
        self.phase = SessionPhase.AWAITING_SELECTION

    def move_to_awaiting_challenge(self) -> None:
        self.phase = SessionPhase.AWAITING_CHALLENGE

    def move_to_awaiting_defense(self) -> None:
        self.phase = SessionPhase.AWAITING_DEFENSE

    def move_to_awaiting_evaluation(self) -> None:
        self.phase = SessionPhase.AWAITING_EVALUATION

    def move_to_awaiting_question(self) -> None:
        self.phase = SessionPhase.AWAITING_QUESTION

    def advance_round(self) -> None:
        self.current_round += 1

    def finish(self) -> None:
        self.phase = SessionPhase.COMPLETE
