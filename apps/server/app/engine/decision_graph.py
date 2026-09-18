"""
Pure data structures for the decision graph.
No web dependencies — fully testable in isolation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum


class NodeStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DECIDED = "decided"
    EVALUATED = "evaluated"
    RECONSIDERED = "reconsidered"


@dataclass
class Option:
    id: str
    label: str


@dataclass
class Decision:
    option_id: str
    reasoning: str
    created_at: str | None = None


@dataclass
class Evaluation:
    feedback: str
    consequence: str
    created_at: str | None = None


@dataclass
class DecisionNode:
    id: str
    area_id: str
    question: str
    options: list[Option]
    parent_id: str | None = None
    branch_label: str | None = None
    status: NodeStatus = NodeStatus.PENDING
    decision: Decision | None = None
    evaluation: Evaluation | None = None
    sequence: int = 0

    @staticmethod
    def create(
        area_id: str,
        question: str,
        options: list[Option],
        parent_id: str | None = None,
        sequence: int = 0,
    ) -> DecisionNode:
        return DecisionNode(
            id=str(uuid.uuid4()),
            area_id=area_id,
            question=question,
            options=options,
            parent_id=parent_id,
            sequence=sequence,
        )


class DecisionGraph:
    """Tree of decision nodes with branch/rewind support."""

    def __init__(self) -> None:
        self.nodes: dict[str, DecisionNode] = {}
        self._sequence = 0

    @property
    def node_count(self) -> int:
        return len(self.nodes)

    def add_node(
        self,
        area_id: str,
        question: str,
        options: list[Option],
        parent_id: str | None = None,
    ) -> DecisionNode:
        self._sequence += 1
        node = DecisionNode.create(
            area_id=area_id,
            question=question,
            options=options,
            parent_id=parent_id,
            sequence=self._sequence,
        )
        self.nodes[node.id] = node
        return node

    def get_node(self, node_id: str) -> DecisionNode | None:
        return self.nodes.get(node_id)

    def choose(self, node_id: str, option_id: str, reasoning: str) -> DecisionNode:
        """Record a decision on a node."""
        node = self.nodes[node_id]
        valid_ids = {o.id for o in node.options}
        if option_id not in valid_ids:
            raise ValueError(f"Invalid option '{option_id}' for node '{node_id}'")

        node.decision = Decision(option_id=option_id, reasoning=reasoning)
        node.status = NodeStatus.DECIDED
        return node

    def evaluate(self, node_id: str, feedback: str, consequence: str) -> DecisionNode:
        """Record an evaluation on a decided node."""
        node = self.nodes[node_id]
        if node.status != NodeStatus.DECIDED:
            raise ValueError(f"Node '{node_id}' is not in DECIDED state")

        node.evaluation = Evaluation(feedback=feedback, consequence=consequence)
        node.status = NodeStatus.EVALUATED
        return node

    def fork(
        self,
        from_node_id: str,
        question: str,
        options: list[Option],
        branch_label: str | None = None,
    ) -> DecisionNode:
        """Create a new branch from an existing node (reconsider)."""
        original = self.nodes[from_node_id]
        original.status = NodeStatus.RECONSIDERED

        new_node = self.add_node(
            area_id=original.area_id,
            question=question,
            options=options,
            parent_id=from_node_id,
        )
        new_node.branch_label = branch_label or f"reconsider-{new_node.sequence}"
        return new_node

    def get_children(self, node_id: str) -> list[DecisionNode]:
        """Get all direct children of a node."""
        return [n for n in self.nodes.values() if n.parent_id == node_id]

    def get_root_nodes(self) -> list[DecisionNode]:
        """Get all root nodes (no parent)."""
        return [n for n in self.nodes.values() if n.parent_id is None]

    def get_path(self, node_id: str) -> list[DecisionNode]:
        """Get the path from root to this node."""
        path: list[DecisionNode] = []
        current = self.nodes.get(node_id)
        while current:
            path.append(current)
            current = self.nodes.get(current.parent_id) if current.parent_id else None
        path.reverse()
        return path

    def to_dict(self) -> dict:
        """Serialize the graph for API responses."""
        return {
            "nodes": {
                nid: {
                    "id": n.id,
                    "area_id": n.area_id,
                    "question": n.question,
                    "options": [{"id": o.id, "label": o.label} for o in n.options],
                    "parent_id": n.parent_id,
                    "branch_label": n.branch_label,
                    "status": n.status.value,
                    "decision": {
                        "option_id": n.decision.option_id,
                        "reasoning": n.decision.reasoning,
                    }
                    if n.decision
                    else None,
                    "evaluation": {
                        "feedback": n.evaluation.feedback,
                        "consequence": n.evaluation.consequence,
                    }
                    if n.evaluation
                    else None,
                    "sequence": n.sequence,
                }
                for nid, n in self.nodes.items()
            }
        }
