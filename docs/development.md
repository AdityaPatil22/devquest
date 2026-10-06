# DevQuest Development

This document covers local development for the current repository.

## Requirements

The repository currently expects:

- Node.js
- npm
- Python 3.12+
- uv
- Make
- curl

## Setup

Clone the repository:

```bash
git clone https://github.com/AdityaPatil22/devquest.git
cd devquest
```

Create local environment configuration when needed:

```bash
cp .env.example .env
```

Install dependencies:

```bash
make install
```

This installs the frontend dependencies with npm and the backend dependencies with uv.

## Run Everything

```bash
make dev
```

The normal development endpoints are:

```text
Game:   http://localhost:5173
Server: http://127.0.0.1:8000
```

Open the game at:

```text
http://localhost:5173
```

## Run Services Individually

### Game

```bash
make dev-game
```

### Server

```bash
make dev-server
```

### Health Check

```bash
curl http://127.0.0.1:8000/api/health
```

## Build

Build the frontend only:

```bash
cd apps/game
npm run build
```

Build the complete package from the repository root:

```bash
make build
```

The repository build copies the generated frontend into the backend static directory so FastAPI can serve the built game.

## Testing

Run all tests:

```bash
make test
```

Frontend tests:

```bash
make test-game
```

Backend tests:

```bash
make test-server
```

## Database Commands

Apply migrations:

```bash
make db-migrate
```

Create a migration:

```bash
make db-revision msg="describe your change"
```

## Configuration

Backend configuration uses the `DEVQUEST_` prefix.

Common settings include:

```text
DEVQUEST_HOST
DEVQUEST_PORT
DEVQUEST_DB_PATH
DEVQUEST_GAME_URL
```

The plugin runtime also supports:

```text
DEVQUEST_GAME_PORT
```

Frontend Vite configuration includes:

```text
VITE_WS_URL
VITE_API_URL
VITE_SHOW_DEV_TOOLBAR
```

Refer to `.env.example` and `apps/server/app/config.py` for current defaults.

## Frontend Development

The game is under:

```text
apps/game/
```

Important areas:

```text
src/components/    React UI
src/game/          Phaser bootstrap and bridge
src/net/           WebSocket client and protocol
src/scenes/        Phaser scenes
src/state/         Session and UI state
src/tilemaps/      Tiled/Phaser map configuration
```

When changing the world, keep room placement, collision, camera behavior, and world bounds in Phaser.

When changing panels or overlays, keep presentation logic in React.

## Backend Development

The server is under:

```text
apps/server/app/
```

Important areas:

```text
api/               Skill-facing HTTP API
engine/            Decision/session domain logic
models/            SQLAlchemy persistence models
services/          Session orchestration
websocket/         Browser WebSocket transport
config.py          Configuration
main.py            FastAPI entry point
```

The session service and server state should remain authoritative for session continuity.

## Runtime Scripts

The plugin uses:

```text
plugin/scripts/install.sh
plugin/scripts/start.sh
```

The startup script is the preferred way to start the integrated DevQuest runtime from Claude Code.

## Recommended Development Flow

```text
Change code
   ↓
Run focused tests
   ↓
Run make test
   ↓
Run the game locally
   ↓
Verify the full decision loop
   ↓
Commit the change
```

When changing both client and server contracts, verify the WebSocket and skill API behavior together rather than testing either side in isolation.
