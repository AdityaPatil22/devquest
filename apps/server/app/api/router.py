from fastapi import APIRouter

from app.api.skill_routes import router as skill_router

api_router = APIRouter()
api_router.include_router(skill_router, prefix="/skill", tags=["skill"])


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "devquest"}
