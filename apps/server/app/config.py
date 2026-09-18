from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "127.0.0.1"
    port: int = 8000
    db_path: str = str(Path.home() / ".devquest" / "sessions.db")
    game_url: str = "http://localhost:5173"
    debug: bool = False

    model_config = {"env_prefix": "DEVQUEST_"}


settings = Settings()
