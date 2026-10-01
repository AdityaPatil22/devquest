"""Tests for the decision engine — no web dependencies."""

from app.engine.decision_graph import DecisionGraph, NodeStatus, Option, Recommendation
from app.engine.engine import DecisionEngine
from app.engine.events import EventType


class TestDecisionGraph:
    def test_add_node(self):
        graph = DecisionGraph()
        node = graph.add_node(
            question="Which database?",
            options=[Option(id="A", label="PostgreSQL"), Option(id="B", label="MongoDB")],
        )
        assert node.id is not None
        assert node.question == "Which database?"
        assert len(node.options) == 2
        assert len(graph.nodes) == 1

    def test_choose(self):
        graph = DecisionGraph()
        node = graph.add_node(
            question="API style?",
            options=[Option(id="A", label="REST"), Option(id="B", label="GraphQL")],
        )

        graph.choose(node.id, "A", context="REST is simpler for CRUD")

        assert node.status == NodeStatus.DECIDED
        assert node.decision is not None
        assert node.decision.option_id == "A"
        assert node.decision.context == "REST is simpler for CRUD"

    def test_recommendation(self):
        graph = DecisionGraph()
        node = graph.add_node(
            question="Which language?",
            options=[Option(id="A", label="Go"), Option(id="B", label="Rust")],
            recommendation=Recommendation(option="A", why="Team has Go experience"),
        )
        assert node.recommendation is not None
        assert node.recommendation.option == "A"

    def test_get_chain(self):
        graph = DecisionGraph()
        n1 = graph.add_node("Q1", [Option("A", "A")])
        n2 = graph.add_node("Q2", [Option("B", "B")])
        chain = graph.get_chain()
        assert len(chain) == 2
        assert chain[0].id == n1.id
        assert chain[1].id == n2.id

    def test_decided_count(self):
        graph = DecisionGraph()
        n1 = graph.add_node("Q1", [Option("A", "X")])
        graph.add_node("Q2", [Option("A", "Y")])
        graph.choose(n1.id, "A")
        assert graph.decided_count == 1

    def test_to_dict(self):
        graph = DecisionGraph()
        graph.add_node("Q1", [Option("A", "X")])
        result = graph.to_dict()
        assert "nodes" in result
        assert len(result["nodes"]) == 1


class TestDecisionEngine:
    def test_create_session(self):
        engine = DecisionEngine()
        session, event = engine.create_session()
        assert session.session_id is not None
        assert event.type == EventType.SESSION_STARTED
        assert engine.get_session(session.session_id) is session

    def test_submit_problem(self):
        engine = DecisionEngine()
        session, _ = engine.create_session()
        engine.submit_problem(session, "Should I rewrite in Go?")
        assert session.problem == "Should I rewrite in Go?"

    def test_create_decision(self):
        engine = DecisionEngine()
        session, _ = engine.create_session()
        event = engine.create_decision(
            session,
            "Which language?",
            [{"id": "A", "label": "Go"}, {"id": "B", "label": "Rust"}],
            recommendation={"option": "A", "why": "Team knows Go"},
        )
        assert event.type == EventType.DECISION_CREATED
        assert event.data["question"] == "Which language?"
        assert len(event.data["options"]) == 2
        assert event.data["recommendation"]["option"] == "A"

    def test_full_flow(self):
        engine = DecisionEngine()
        session, _ = engine.create_session()
        engine.submit_problem(session, "Caching strategy")

        # Skill creates decision
        event = engine.create_decision(
            session, "Cache layer?",
            [{"id": "A", "label": "Redis"}, {"id": "B", "label": "In-memory"}],
        )
        node_id = event.data["nodeId"]

        # Player selects
        engine.select_option(session, node_id, "A", context="Need distributed cache")

        # Finish
        finish_event = engine.finish_session(session, "Redis caching", "# Doc\n...")
        assert finish_event.type == EventType.SESSION_COMPLETE
        assert finish_event.data["decisionsCount"] == 1

    def test_select_option_without_context(self):
        engine = DecisionEngine()
        session, _ = engine.create_session()

        event = engine.create_decision(
            session,
            "Which database?",
            [
                {"id": "A", "label": "PostgreSQL"},
                {"id": "B", "label": "MongoDB"},
            ],
        )

        node_id = event.data["nodeId"]

        # Select without providing context.
        engine.select_option(
            session,
            node_id,
            "A",
        )

        node = session.graph.get_node(node_id)

        assert node is not None
        assert node.decision is not None
        assert node.decision.option_id == "A"
        assert node.decision.context is None

    def test_select_option_with_empty_context(self):
        engine = DecisionEngine()
        session, _ = engine.create_session()

        event = engine.create_decision(
            session,
            "Which queue?",
            [
                {"id": "A", "label": "RabbitMQ"},
                {"id": "B", "label": "Kafka"},
            ],
        )

        node_id = event.data["nodeId"]

        engine.select_option(
            session,
            node_id,
            "B",
            context="   ",
        )

        node = session.graph.get_node(node_id)

        assert node is not None
        assert node.decision is not None
        assert node.decision.option_id == "B"
        assert node.decision.context is None
