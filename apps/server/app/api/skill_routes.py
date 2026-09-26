"""
Skill-facing API — the Claude Code skill communicates with these endpoints.
Bridges skill responses to the game client via WebSocket.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.session_service import session_service

router = APIRouter()


# ─── Request models ───

class DecisionPayload(BaseModel):
    """Skill sends a new decision question."""
    session_id: str
    question: str
    options: list[dict]
    recommendation: dict | None = None
    round: int = 1
    depends_on: str | None = None

class EvaluationPayload(BaseModel):
    """Skill sends an evaluation."""
    session_id: str
    node_id: str
    feedback: str
    consequence: str


class FinishPayload(BaseModel):
    """Skill says the session is complete."""
    session_id: str
    summary: str
    doc_content: str
    decisions_count: int | None = None
    reconsidered_count: int | None = None


# ─── Skill-facing endpoints ───

@router.get("/events/pending")
async def get_pending_events(session_id: str | None = None):
    """Skill polls this to get player actions."""
    event = await session_service.get_pending_player_event(session_id)
    if event is None:
        return {"event": None}
    return {"event": event}


@router.get("/events/pending/long-poll")
async def get_pending_events_long_poll(
    session_id: str | None = None,
    timeout: int = 30,
):
    """Long-poll — blocks until a player event arrives or timeout."""
    event = await session_service.wait_for_player_event(session_id, timeout=timeout)
    if event is None:
        return {"event": None}
    return {"event": event}


@router.post("/decisions")
async def create_decision(payload: DecisionPayload):
    """Skill sends a new question with doors for the player."""
    await session_service.skill_create_decision(
        session_id=payload.session_id,
        question=payload.question,
        options=payload.options,
        recommendation=payload.recommendation,
        round_num=payload.round,
        depends_on=payload.depends_on,
    )
    return {"status": "sent"}

@router.post("/evaluation")
async def send_evaluation(payload: EvaluationPayload):
    """Skill sends evaluation of the decision."""
    await session_service.skill_send_evaluation(
        session_id=payload.session_id,
        node_id=payload.node_id,
        feedback=payload.feedback,
        consequence=payload.consequence,
    )
    return {"status": "sent"}


@router.post("/finish")
async def finish_session(payload: FinishPayload):
    """Skill says the grilling is done. Send trophy to player."""
    await session_service.skill_finish(
        session_id=payload.session_id,
        summary=payload.summary,
        doc_content=payload.doc_content,
    )
    return {"status": "sent"}


@router.get("/sessions")
async def list_sessions():
    """List all sessions."""
    sessions = session_service.list_sessions()
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details including the decision graph."""
    info = session_service.get_session_info(session_id)
    if info is None:
        return {"error": "Session not found"}
    return info
