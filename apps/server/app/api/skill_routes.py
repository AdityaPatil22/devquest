"""
Skill-facing API — the Claude Code skill communicates with these endpoints.
These endpoints bridge the skill's responses to the game client via WebSocket.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.session_service import session_service

router = APIRouter()


# ─── Request models ───


class DecisionPayload(BaseModel):
    """Skill sends a new decision question."""
    session_id: str
    area_id: str
    question: str
    options: list[dict]
    context: str | None = None


class ChallengePayload(BaseModel):
    """Skill sends a follow-up challenge."""
    session_id: str
    node_id: str
    question: str


class EvaluationPayload(BaseModel):
    """Skill sends an evaluation."""
    session_id: str
    node_id: str
    feedback: str
    consequence: str


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
    """Long-poll variant — blocks until a player event arrives or timeout."""
    event = await session_service.wait_for_player_event(
        session_id, timeout=timeout
    )
    if event is None:
        return {"event": None}
    return {"event": event}


@router.post("/decisions")
async def create_decision(payload: DecisionPayload):
    """Skill sends a new question for the player."""
    await session_service.skill_create_decision(
        session_id=payload.session_id,
        area_id=payload.area_id,
        question=payload.question,
        options=payload.options,
    )
    return {"status": "sent"}


@router.post("/challenge")
async def send_challenge(payload: ChallengePayload):
    """Skill sends a follow-up challenge."""
    await session_service.skill_send_challenge(
        session_id=payload.session_id,
        node_id=payload.node_id,
        question=payload.question,
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


@router.get("/sessions")
async def list_sessions():
    """List all active sessions."""
    sessions = session_service.list_sessions()
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details including the decision graph."""
    info = session_service.get_session_info(session_id)
    if info is None:
        return {"error": "Session not found"}
    return info
