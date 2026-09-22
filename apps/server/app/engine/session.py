"""
Session state machine — tracks the phase of a grilling session.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

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
        self.summary: str | None = None
        self.doc_content: str | None = None
        self.world: dict[str, Any] = {
            "rooms": [],
            "currentRoomId": None,
            "progressionIndex": 0,
        }
        self.player: dict[str, Any] = {
            "position": {"x": 0, "y": 0},
            "currentRoomId": None,
            "completedRooms": [],
        }

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

    def finish(self, summary: str, doc_content: str) -> None:
        self.summary = summary
        self.doc_content = doc_content
        self.phase = SessionPhase.COMPLETE

    def set_world_state(self, state: dict[str, Any]) -> None:
        self.world = {
            "rooms": [dict(room) for room in state.get("rooms", [])],
            "currentRoomId": state.get("currentRoomId"),
            "progressionIndex": max(0, int(state.get("progressionIndex", 0))),
        }

    def set_player_state(self, state: dict[str, Any]) -> None:
        position = state.get("position") or {}
        self.player = {
            "position": {
                "x": float(position.get("x", 0)),
                "y": float(position.get("y", 0)),
            },
            "currentRoomId": state.get("currentRoomId"),
            "completedRooms": list(state.get("completedRooms", [])),
        }