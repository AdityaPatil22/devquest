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
    CHALLENGED = "challenged"
    EVALUATED = "evaluated"
    RECONSIDERED = "reconsidered"


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
    defense: str | None = None


@dataclass
class Evaluation:
    feedback: str
    consequence: str


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
    challenge: str | None = None
    evaluation: Evaluation | None = None
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
    def node_count(self) -> int:
        return len(self.nodes)

    @property
    def decided_count(self) -> int:
        return sum(
            1
            for n in self.nodes.values()
            if n.status == NodeStatus.EVALUATED
        )

    @property
    def reconsidered_count(self) -> int:
        return sum(
            1
            for n in self.nodes.values()
            if n.status == NodeStatus.RECONSIDERED
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

    def set_challenge(
        self,
        node_id: str,
        challenge: str,
    ) -> DecisionNode:
        """Record the challenge question."""

        node = self.nodes[node_id]

        node.challenge = challenge
        node.status = NodeStatus.CHALLENGED

        return node

    def set_defense(
        self,
        node_id: str,
        defense: str,
    ) -> DecisionNode:
        """Record the player's defense."""

        node = self.nodes[node_id]

        if node.decision:
            node.decision.defense = defense

        return node

    def evaluate(
        self,
        node_id: str,
        feedback: str,
        consequence: str,
    ) -> DecisionNode:
        """Record an evaluation on a decided node."""

        node = self.nodes[node_id]

        node.evaluation = Evaluation(
            feedback=feedback,
            consequence=consequence,
        )

        node.status = NodeStatus.EVALUATED

        return node

    def fork(
        self,
        from_node_id: str,
        question: str,
        options: list[Option],
        recommendation: Recommendation | None = None,
        description: str = "",
    ) -> DecisionNode:
        """Create a new branch from an existing node."""

        original = self.nodes[from_node_id]

        original.status = NodeStatus.RECONSIDERED

        new_node = self.add_node(
            question=question,
            options=options,
            description=description,
            recommendation=recommendation,
            round=original.round,
            parent_id=from_node_id,
        )

        new_node.branch_label = f"reconsider-{new_node.sequence}"

        return new_node

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
                            "defense": node.decision.defense,
                        }
                        if node.decision
                        else None
                    ),
                    "challenge": node.challenge,
                    "evaluation": (
                        {
                            "feedback": node.evaluation.feedback,
                            "consequence": node.evaluation.consequence,
                        }
                        if node.evaluation
                        else None
                    ),
                    "sequence": node.sequence,
                }
                for node in self.get_chain()
            ],
            "decided_count": self.decided_count,
            "reconsidered_count": self.reconsidered_count,
        }