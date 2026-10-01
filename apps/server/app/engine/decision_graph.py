"""
Pure data structures for the decision graph.
No web dependencies — fully testable in isolation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from enum import Enum


class NodeStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DECIDED = "decided"


@dataclass
class Option:
    id: str
    label: str
    description: str = ""


@dataclass
class Recommendation:
    option: str
    why: str
    what_to_know: str = ""


@dataclass
class Decision:
    option_id: str
    context: str | None = None


@dataclass
class DecisionNode:
    id: str
    question: str
    options: list[Option]
    description: str = ""
    recommendation: Recommendation | None = None
    round: int = 1
    parent_id: str | None = None
    depends_on: str | None = None
    branch_label: str | None = None
    status: NodeStatus = NodeStatus.PENDING
    decision: Decision | None = None
    sequence: int = 0

    @staticmethod
    def create(
        question: str,
        options: list[Option],
        description: str = "",
        recommendation: Recommendation | None = None,
        round: int = 1,
        parent_id: str | None = None,
        depends_on: str | None = None,
        sequence: int = 0,
    ) -> DecisionNode:
        return DecisionNode(
            id=str(uuid.uuid4()),
            question=question,
            options=options,
            description=description,
            recommendation=recommendation,
            round=round,
            parent_id=parent_id,
            depends_on=depends_on,
            sequence=sequence,
        )


class DecisionGraph:
    """Chain of decision nodes with branch/rewind support."""

    def __init__(self) -> None:
        self.nodes: dict[str, DecisionNode] = {}
        self._sequence = 0

    @property
    def decided_count(self) -> int:
        return sum(
            1
            for n in self.nodes.values()
            if n.status == NodeStatus.DECIDED
        )

    def add_node(
        self,
        question: str,
        options: list[Option],
        description: str = "",
        recommendation: Recommendation | None = None,
        round: int = 1,
        parent_id: str | None = None,
        depends_on: str | None = None,
    ) -> DecisionNode:
        self._sequence += 1

        node = DecisionNode.create(
            question=question,
            options=options,
            description=description,
            recommendation=recommendation,
            round=round,
            parent_id=parent_id,
            depends_on=depends_on,
            sequence=self._sequence,
        )

        self.nodes[node.id] = node

        return node

    def get_node(self, node_id: str) -> DecisionNode | None:
        return self.nodes.get(node_id)

    def choose(
        self,
        node_id: str,
        option_id: str,
        context: str | None = None,
    ) -> DecisionNode:
        """Record a decision on a node."""

        node = self.nodes[node_id]

        valid_ids = {o.id for o in node.options}

        if option_id not in valid_ids:
            raise ValueError(
                f"Invalid option '{option_id}' for node '{node_id}'"
            )

        node.decision = Decision(
            option_id=option_id,
            context=context,
        )

        node.status = NodeStatus.DECIDED

        return node

    def get_chain(self) -> list[DecisionNode]:
        """Get all nodes in sequence order."""

        return sorted(
            self.nodes.values(),
            key=lambda n: n.sequence,
        )

    def to_dict(self) -> dict:
        """Serialize the graph for API responses."""

        return {
            "nodes": [
                {
                    "id": node.id,
                    "question": node.question,
                    "description": node.description,
                    "options": [
                        {
                            "id": option.id,
                            "label": option.label,
                            "description": option.description,
                        }
                        for option in node.options
                    ],
                    "recommendation": (
                        {
                            "option": node.recommendation.option,
                            "why": node.recommendation.why,
                            "whatToKnow": (
                                node.recommendation.what_to_know
                            ),
                        }
                        if node.recommendation
                        else None
                    ),
                    "round": node.round,
                    "parent_id": node.parent_id,
                    "depends_on": node.depends_on,
                    "status": node.status.value,
                    "decision": (
                        {
                            "option_id": node.decision.option_id,
                            "context": node.decision.context,
                        }
                        if node.decision
                        else None
                    ),
                    "sequence": node.sequence,
                }
                for node in self.get_chain()
            ],
            "decided_count": self.decided_count,
        }