.PHONY: dev dev-game dev-server install install-game install-server build test test-game test-server clean

# --- Development ---

dev:
	@echo "Starting DevQuest (server + game)..."
	@make dev-server &
	@make dev-game

dev-game:
	cd apps/game && npm run dev

dev-server:
	cd apps/server && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# --- Install ---

install: install-server install-game

install-game:
	cd apps/game && npm install

install-server:
	cd apps/server && uv sync

# --- Build ---

build:
	cd apps/game && npm run build
	rm -rf apps/server/app/static
	cp -r apps/game/dist apps/server/app/static

# --- Test ---

test: test-server test-game

test-game:
	cd apps/game && npm test

test-server:
	cd apps/server && uv run pytest

# --- Database ---

db-migrate:
	cd apps/server && uv run alembic upgrade head

db-revision:
	cd apps/server && uv run alembic revision --autogenerate -m "$(msg)"

# --- Clean ---

clean:
	rm -rf apps/game/node_modules apps/game/dist
	rm -rf apps/server/.venv apps/server/app/static
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
