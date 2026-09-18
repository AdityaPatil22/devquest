"""Tests for the decision engine — no web dependencies."""

from app.engine.decision_graph import DecisionGraph, NodeStatus, Option
from app.engine.engine import DecisionEngine
from app.engine.events import EventType


class TestDecisionGraph:
    def test_add_node(self):
        graph = DecisionGraph()
        node = graph.add_node(
            area_id="database-lab",
            question="Which database?",
            options=[
                Option(id="pg", label="PostgreSQL"),
                Option(id="mongo", label="MongoDB"),
            ],
        )
        assert node.id is not None
        assert node.area_id == "database-lab"
        assert len(node.options) == 2
        assert graph.node_count == 1

    def test_choose(self):
        graph = DecisionGraph()
        node = graph.add_node(
            area_id="api-lab",
            question="API style?",
            options=[
                Option(id="rest", label="REST"),
                Option(id="graphql", label="GraphQL"),
            ],
        )

        graph.choose(node.id, "rest", "Simpler for CRUD operations")

        assert node.status == NodeStatus.DECIDED
        assert node.decision is not None
        assert node.decision.option_id == "rest"
        assert node.decision.reasoning == "Simpler for CRUD operations"

    def test_evaluate(self):
        graph = DecisionGraph()
        node = graph.add_node(
            area_id="api-lab",
            question="API style?",
            options=[Option(id="rest", label="REST")],
        )
        graph.choose(node.id, "rest", "Simple")
        graph.evaluate(node.id, "Good choice", "Consider versioning")

        assert node.status == NodeStatus.EVALUATED
        assert node.evaluation is not None
        assert node.evaluation.feedback == "Good choice"

    def test_fork(self):
        graph = DecisionGraph()
        original = graph.add_node(
            area_id="database-lab",
            question="Which database?",
            options=[
                Option(id="pg", label="PostgreSQL"),
                Option(id="mongo", label="MongoDB"),
            ],
        )
        graph.choose(original.id, "pg", "Relational data")
        graph.evaluate(original.id, "Good", "Consider scaling")

        forked = graph.fork(
            original.id,
            "Reconsidering: Which database?",
            [
                Option(id="pg", label="PostgreSQL"),
                Option(id="mongo", label="MongoDB"),
            ],
        )

        assert original.status == NodeStatus.RECONSIDERED
        assert forked.parent_id == original.id
        assert forked.branch_label is not None
        assert graph.node_count == 2

    def test_get_path(self):
        graph = DecisionGraph()
        root = graph.add_node("area1", "Q1", [Option("a", "A")])
        child = graph.add_node("area2", "Q2", [Option("b", "B")], parent_id=root.id)

        path = graph.get_path(child.id)
        assert len(path) == 2
        assert path[0].id == root.id
        assert path[1].id == child.id

    def test_to_dict(self):
        graph = DecisionGraph()
        graph.add_node("area1", "Q1", [Option("a", "A")])
        result = graph.to_dict()

        assert "nodes" in result
        assert len(result["nodes"]) == 1


class TestDecisionEngine:
    def test_create_session(self):
        engine = DecisionEngine()
        session, event = engine.create_session(project="test-project")

        assert session.session_id is not None
        assert event.type == EventType.SESSION_STARTED
        assert engine.get_session(session.session_id) is session

    def test_enter_area(self):
        engine = DecisionEngine()
        session, _ = engine.create_session()
        event = engine.enter_area(session, "database-lab")

        assert event.data["areaId"] == "database-lab"

    def test_create_decision(self):
        engine = DecisionEngine()
        session, _ = engine.create_session()
        event = engine.create_decision(
            session,
            "api-lab",
            "Which API style?",
            [{"id": "rest", "label": "REST"}, {"id": "graphql", "label": "GraphQL"}],
        )

        assert event.type == EventType.DECISION_CREATED
        assert event.data["question"] == "Which API style?"
        assert len(event.data["options"]) == 2
        assert session.graph.node_count == 1
