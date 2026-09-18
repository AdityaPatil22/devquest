"""Engine events — emitted by the decision engine, consumed by WebSocket/API handlers."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class EventType(str, Enum):
    SESSION_STARTED = "SESSION_STARTED"
    DECISION_CREATED = "DECISION_CREATED"
    REASONING_REQUESTED = "REASONING_REQUESTED"
    CHALLENGE = "CHALLENGE"
    EVALUATION = "EVALUATION"
    AREA_COMPLETED = "AREA_COMPLETED"
    SESSION_COMPLETE = "SESSION_COMPLETE"
    ERROR = "ERROR"


@dataclass
class EngineEvent:
    type: EventType
    data: dict = field(default_factory=dict)

    def to_ws_message(self) -> dict:
        return {"type": self.type.value, **self.data}
