"""SQLAlchemy models and database initialization."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True)
    project = Column(String, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    nodes = relationship("DecisionNodeModel", back_populates="session")


class DecisionNodeModel(Base):
    __tablename__ = "decision_nodes"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    parent_id = Column(String, ForeignKey("decision_nodes.id"), nullable=True)
    area_id = Column(String, nullable=False)
    question = Column(Text, nullable=False)
    status = Column(String, default="pending")
    branch_label = Column(String, nullable=True)
    sequence = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("SessionModel", back_populates="nodes")
    options = relationship("OptionModel", back_populates="node")
    decision = relationship("DecisionModel", back_populates="node", uselist=False)
    evaluation = relationship("EvaluationModel", back_populates="node", uselist=False)


class OptionModel(Base):
    __tablename__ = "options"

    id = Column(String, primary_key=True)
    node_id = Column(String, ForeignKey("decision_nodes.id"), nullable=False)
    label = Column(String, nullable=False)

    node = relationship("DecisionNodeModel", back_populates="options")


class DecisionModel(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(String, ForeignKey("decision_nodes.id"), nullable=False, unique=True)
    option_id = Column(String, nullable=False)
    reasoning = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    node = relationship("DecisionNodeModel", back_populates="decision")


class EvaluationModel(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(String, ForeignKey("decision_nodes.id"), nullable=False, unique=True)
    feedback = Column(Text, nullable=False)
    consequence = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    node = relationship("DecisionNodeModel", back_populates="evaluation")


# ─── Database initialization ───

_engine = None
_session_factory = None


async def init_db(db_path: str) -> None:
    """Create tables if they don't exist."""
    global _engine, _session_factory
    _engine = create_engine(f"sqlite:///{db_path}", echo=False)
    _session_factory = sessionmaker(bind=_engine)
    Base.metadata.create_all(_engine)


def get_db() -> Session:
    """Get a database session."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized")
    return _session_factory()
