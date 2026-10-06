# DevQuest Architecture

This document describes the architecture represented by the current `master` branch.

## Overview

DevQuest has three primary layers:

```text
Claude Code
    ↓
DevQuest Skill
    ↓ HTTP / long-polling
FastAPI
    ↓ WebSocket
React + Phaser
```

The responsibilities are intentionally separated:

| Layer | Responsibility |
|---|---|
| Claude Code | Engineering reasoning and decision generation |
| FastAPI | Authoritative session state and communication |
| React | UI and overlays |
| Phaser | Interactive game world |

The central principle is:

> **Claude owns the reasoning, the server owns session continuity, React owns presentation, and Phaser owns the world.**

## System Components

### Claude Code Skill

Location:

```text
plugin/skills/devquest/SKILL.md
```

The skill:

- understands the engineering problem,
- inspects repository context when available,
- identifies meaningful decisions,
- generates exactly four options,
- provides recommendations and trade-offs,
- incorporates player choices and context,
- determines the next decision,
- determines when the problem is sufficiently explored,
- generates the final implementation plan.

The skill does not control player movement, map coordinates, collision, or rendering.

### FastAPI

Location:

```text
apps/server/app/
```

FastAPI is the authoritative session boundary.

It manages:

- sessions,
- decision state,
- decision graph data,
- player event queues,
- skill-facing HTTP endpoints,
- WebSocket communication,
- persistence,
- final document generation state.

### React

Location:

```text
apps/game/src/components/
apps/game/src/state/GameUIContext.tsx
```

React owns presentation such as:

- problem input,
- decision panels,
- context UI,
- waiting states,
- status information,
- final document presentation.

### Phaser

Location:

```text
apps/game/src/scenes/
apps/game/src/scenes/grilling/
apps/game/src/game/
```

Phaser owns:

- player movement,
- camera behavior,
- collision,
- doors,
- Decision Rooms,
- Corridors,
- Options Rooms,
- room alignment,
- world bounds,
- interactable objects,
- Trophy Room.

## Frontend Architecture

The frontend is a React + Phaser application.

```text
React UI
   │
   │ GameBridge
   ▼
Phaser
   ├── BootScene
   ├── GrillingScene
   └── TrophyScene
```

The main state modules are:

```text
apps/game/src/state/
├── GameState.ts
├── GameUIContext.tsx
└── SessionStore.ts
```

### SessionStore

`SessionStore` stores authoritative session/domain information received from the server, including:

- session ID,
- problem,
- current phase,
- current decision,
- decision history,
- round,
- summary,
- final document.

### GameUIContext

`GameUIContext` stores presentation state such as:

- active screen,
- active modal,
- question data,
- options,
- recommendation,
- prompts,
- waiting state,
- errors,
- final document UI.

### GameBridge

`GameBridge` connects Phaser events to React UI state and lets React trigger gameplay actions where needed.

## World Architecture

The main gameplay world is progressively assembled from map segments:

```text
Decision Room
     ↓
Corridor
     ↓
Options Room
     ↓
Corridor
     ↓
Options Room
     ↓
...
```

The world manager is responsible for:

- loading tilemaps,
- placing rooms,
- aligning entrances and exits,
- updating collision,
- expanding world bounds,
- adding corridor interactions,
- locking the Corridor exit while Claude is processing,
- unlocking the exit when the next decision is available.

Map configuration lives under:

```text
apps/game/src/tilemaps/
```

## Session Flow

A session begins when the game connects to FastAPI and creates or resumes a session.

The browser keeps the session ID and reconnects with it when necessary.

Conceptually:

```text
Browser
   ↓
WebSocket + session_id
   ↓
FastAPI
   ↓
Authoritative session
   ↓
SESSION_RESUMED
   ↓
SessionStore hydration
   ↓
Game state restored
```

The browser is therefore a projection of server-side session state rather than the sole source of truth.

## Communication Model

There are two directions.

### Claude Skill → FastAPI

The skill uses HTTP endpoints to:

- retrieve player events,
- create decisions,
- mark final document generation as started,
- complete the session with the final document.

### Game → FastAPI

The game uses a WebSocket connection for interactive session events.

The current core events are:

```text
Client → Server
PROBLEM_SUBMITTED
OPTION_SELECTED

Server → Client
SESSION_STARTED
SESSION_RESUMED
DECISION_CREATED
FINAL_DOCUMENT_GENERATING
SESSION_COMPLETE
ERROR
```

See [networking.md](networking.md) for the full contract.

## Decision Graph

DevQuest models the planning process as a sequence of decision nodes rather than an unstructured conversation.

A decision can contain:

- a question,
- four options,
- a recommendation,
- a round number,
- dependency information.

The resulting history lets the final implementation document preserve how the player reached the chosen architecture.

## Production Packaging

The frontend can be built and copied into the FastAPI static directory.

```text
Vite build
   ↓
apps/game/dist
   ↓
apps/server/app/static
   ↓
FastAPI serves the built game
```

The repository `Makefile` contains the supported build command.

## Repository Structure

```text
devquest/
├── apps/
│   ├── game/
│   │   ├── public/assets/
│   │   └── src/
│   │       ├── components/
│   │       ├── entities/
│   │       ├── game/
│   │       ├── net/
│   │       ├── scenes/
│   │       ├── state/
│   │       └── tilemaps/
│   └── server/
│       ├── app/
│       │   ├── api/
│       │   ├── engine/
│       │   ├── models/
│       │   ├── services/
│       │   └── websocket/
│       └── tests/
├── docs/
├── plugin/
└── Makefile
```

## Architectural Invariants

1. Engineering reasoning belongs in the Claude Code skill, not Phaser.
2. Session continuity belongs to FastAPI.
3. World geometry and gameplay belong to Phaser.
4. React owns presentation, not game-world rules.
5. The four-option contract must remain stable between skill and game.
6. The Decision Room → Corridor → Options Room loop must remain continuous.
7. The final document is generated from the session's authoritative decision history.
