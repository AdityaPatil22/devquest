from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.config import settings
from app.models.database import init_db
from app.websocket.handlers import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    db_path = Path(settings.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    await init_db(str(db_path))
    yield


app = FastAPI(
    title="DevQuest",
    description="Interactive AI Engineering Decision Simulator",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.game_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes (for skill communication)
app.include_router(api_router, prefix="/api")

# WebSocket endpoint (for game client)
app.add_api_websocket_route("/ws", websocket_endpoint)

# Serve built game files in production
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="game")
