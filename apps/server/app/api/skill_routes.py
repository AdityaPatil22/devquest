"""
Skill-facing API — the Claude Code skill communicates with these endpoints.
Bridges skill responses to the game client via WebSocket.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.session_service import session_service

router = APIRouter()


# ─────────────────────────────────────────────
# Request models
# ─────────────────────────────────────────────


class OptionPayload(BaseModel):
    """One decision-room door."""

    id: Literal["A", "B", "C", "D"]

    label: str = Field(
        min_length=1,
    )

    description: str = Field(
        min_length=1,
    )


class RecommendationPayload(BaseModel):
    """Claude's current recommendation."""

    option: Literal["A", "B", "C", "D"]

    why: str = Field(
        min_length=1,
    )

    what_to_know: str = Field(
        min_length=1,
    )


class DecisionPayload(BaseModel):
    """Skill sends a new decision question."""

    session_id: str

    question: str = Field(
        min_length=1,
    )

    description: str = Field(
        min_length=1,
    )

    options: list[OptionPayload] = Field(
        min_length=4,
        max_length=4,
    )

    recommendation: RecommendationPayload

    round: int = 1

    depends_on: str | None = None


class FinishGeneratingPayload(BaseModel):
    """Skill says final document generation has started."""

    session_id: str


class FinishPayload(BaseModel):
    """Skill submits the generated final implementation plan."""

    session_id: str

    summary: str

    doc_content: str



# ─────────────────────────────────────────────
# Skill-facing endpoints
# ─────────────────────────────────────────────


@router.get("/events/pending")
async def get_pending_events(
    session_id: str,
):
    """Skill polls this to get player actions."""

    event = await session_service.get_pending_player_event(
        session_id,
    )

    if event is None:
        return {
            "event": None,
        }

    return {
        "event": event,
    }


@router.get("/events/pending/long-poll")
async def get_pending_events_long_poll(
    session_id: str,
    timeout: int = 30,
):
    """Long-poll until a player event arrives."""

    event = await session_service.wait_for_player_event(
        session_id,
        timeout=timeout,
    )

    if event is None:
        return {
            "event": None,
        }

    return {
        "event": event,
    }


@router.post("/decisions")
async def create_decision(
    payload: DecisionPayload,
):
    """
    Skill sends a new decision.

    DevQuest requires exactly four doors,
    ordered A, B, C, D.
    """

    option_ids = [
        option.id
        for option in payload.options
    ]

    expected_ids = [
        "A",
        "B",
        "C",
        "D",
    ]

    if option_ids != expected_ids:
        raise HTTPException(
            status_code=422,
            detail=(
                "Decision options must contain exactly "
                "four options ordered A, B, C, D."
            ),
        )

    if payload.recommendation.option not in option_ids:
        raise HTTPException(
            status_code=422,
            detail=(
                "Recommendation option must reference "
                "one of A, B, C, or D."
            ),
        )

    await session_service.skill_create_decision(
        session_id=payload.session_id,
        question=payload.question,
        description=payload.description,
        options=[
            option.model_dump()
            for option in payload.options
        ],
        recommendation=payload.recommendation.model_dump(),
        round_num=payload.round,
        depends_on=payload.depends_on,
    )

    return {
        "status": "sent",
    }


@router.post("/finish/generating")
async def start_document_generation(
    payload: FinishGeneratingPayload,
):
    """Skill signals that the final implementation plan is being generated."""

    await session_service.skill_start_document_generation(
        session_id=payload.session_id,
    )

    return {
        "status": "sent",
    }


@router.post("/finish")
async def finish_session(
    payload: FinishPayload,
):
    """Skill submits the final implementation plan."""

    await session_service.skill_finish(
        session_id=payload.session_id,
        summary=payload.summary,
        doc_content=payload.doc_content,
    )

    return {
        "status": "sent",
    }


@router.get("/sessions")
async def list_sessions():
    """List all sessions."""

    sessions = session_service.list_sessions()

    return {
        "sessions": sessions,
    }


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
):
    """Get session details including the decision graph."""

    info = session_service.get_session_info(
        session_id,
    )

    if info is None:
        return {
            "error": "Session not found",
        }

    return info