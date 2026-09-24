# DevQuest Architecture

> Architecture reference for the current repository implementation.
>
> Repository: https://github.com/AdityaPatil22/devquest
>
> This document describes the architecture represented by the current `master` branch. It is implementation-oriented rather than a generic system-design proposal.

## 1. Overview

DevQuest is an AI-powered engineering decision simulator exposed as a 2D game.

The system separates **engineering reasoning** from **game presentation**:

- The **Claude Code DevQuest skill** drives the interview: it creates decision questions, alternatives, recommendations, challenges, evaluations, and the final decision document.
- The **FastAPI server** is the application broker and authoritative session-state boundary. It accepts player events, exposes skill-facing HTTP APIs, manages the decision graph, provides event queues, persists session data, and pushes skill-generated events to the game.
- The **React/Phaser client** is the interactive presentation layer. Phaser owns movement, maps, doors, collision, scene transitions, and gameplay interaction. React owns overlays, forms, prompts, challenge/evaluation panels, waiting states, and the trophy summary.

The central design principle is:

> **The skill owns the intelligence; the game owns the experience; FastAPI owns the session boundary and transport between them.**

## 2. System Context

```text
                          Claude Code
                               |
                               | /devquest skill
                               v
                    +-----------------------+
                    |   DevQuest Skill      |
                    |-----------------------|
                    | - Problem analysis    |
                    | - Decision generation |
                    | - Recommendations     |
                    | - Challenges          |
                    | - Evaluations         |
                    | - Final document      |
                    +-----------+-----------+
                                |
                     HTTP skill API / polling
                                |
                                v
                    +-----------------------+
                    |    FastAPI Server     |
                    |-----------------------|
                    | SessionService        |
                    | DecisionEngine        |
                    | DecisionGraph         |
                    | Player event queues   |
                    | WebSocket manager     |
                    | SQLite persistence    |
                    +-----------+-----------+
                                |
                         WebSocket /ws
                                |
                                v
             +--------------------------------------+
             |          React + Phaser Game          |
             |--------------------------------------|
             | React UI                              |
             | - HUD / prompts                       |
             | - input modals                        |
             | - challenges/evaluations              |
             | - waiting states                      |
             | - trophy summary                      |
             |                                      |
             | Phaser                               |
             | - scenes / maps                       |
             | - player movement                     |
             | - doors / elevator / trophy           |
             | - collision                           |
             | - scene transitions                   |
             +--------------------------------------+
```

## 3. Repository Structure

```text
devquest/
├── apps/
│   ├── game/
│   │   ├── public/assets/
│   │   ├── src/
│   │   │   ├── components/       # React presentation
│   │   │   ├── dev/              # Development-only tooling
│   │   │   ├── entities/         # Phaser entities
│   │   │   ├── game/             # Phaser bootstrap + React bridge
│   │   │   ├── net/              # WebSocket client + protocol
│   │   │   ├── scenes/           # Phaser scenes
│   │   │   ├── state/            # Client/session/UI state
│   │   │   └── tilemaps/         # Tiled/Phaser map configuration
│   │   └── package.json
│   │
│   └── server/
│       ├── app/
│       │   ├── api/              # Skill-facing HTTP API
│       │   ├── engine/           # Domain logic + decision graph
│       │   ├── models/           # SQLAlchemy persistence
│       │   ├── services/         # Session orchestration
│       │   ├── websocket/        # Game WebSocket transport
│       │   ├── cli.py
│       │   ├── config.py
│       │   └── main.py
│       └── tests/
│
├── plugin/
│   └── skills/
│       └── devquest/
│           └── SKILL.md          # Claude Code skill definition
├── Makefile
├── .env.example
└── README.md
```

## 4. Runtime Components

### Claude Code Skill

The skill is defined in `plugin/skills/devquest/SKILL.md`.

It owns:

- problem understanding
- decision generation
- concrete alternatives
- recommendations
- challenges
- defense evaluation
- decision-tree progression
- final engineering decision document

The skill does not render Phaser or directly control the browser.

### FastAPI Application

The FastAPI entry point is `apps/server/app/main.py`.

It:

- initializes the database
- registers `/api` routes
- exposes the `/ws` WebSocket endpoint
- configures CORS
- serves built game files when the production static directory exists

### SessionService

`apps/server/app/services/session_service.py` is the main orchestration layer.

It coordinates:

```text
Skill-facing requests
        |
        v
SessionService
   |       |       |
   v       v       v
Engine   Queues   WebSocket Manager
```

Responsibilities:

- create/look up sessions
- enqueue player actions
- expose pending/long-polled player events to the skill
- pass skill-generated events to the game
- mutate session state through the decision engine

### Decision Engine

The domain model lives under `apps/server/app/engine`.

The decision graph implementation is `decision_graph.py`.

Core types:

- `DecisionGraph`
- `DecisionNode`
- `Option`
- `Recommendation`
- `Decision`
- `Evaluation`
- `NodeStatus`

A node can move through states such as:

```text
PENDING -> DECIDED -> CHALLENGED -> EVALUATED
                              |
                              +-> RECONSIDERED
```

Reconsideration preserves the original node and creates a new branch.

## 5. Session State

The server maintains an authoritative session containing:

- session ID
- problem statement
- phase
- round
- current node ID
- decision graph
- summary
- final Markdown document

The WebSocket layer serializes an authoritative snapshot containing:

```text
sessionId
problem
phase
round
currentNodeId
decisions[]
summary
docContent
```

The browser hydrates its client-side state from this snapshot on reconnect.

## 6. Persistence

The current persistence layer uses **SQLite + SQLAlchemy**.

The model in `apps/server/app/models/database.py` is structured as:

```text
sessions
   |
   +---- decision_nodes
             |
             +---- options
             |
             +---- decisions
             |
             +---- evaluations
```

### sessions

Stores the DevQuest session identity and lifecycle metadata.

### decision_nodes

Stores:

- node ID
- session ID
- parent node
- question
- status
- branch label
- sequence
- area

### options

Stores the concrete choices available for a node.

### decisions

Stores the selected option and player's reasoning.

### evaluations

Stores feedback and consequence for a decision.

This relational model mirrors the in-memory graph representation.

## 7. Client Architecture

The game is a hybrid **React + Phaser** application.

```text
React application
      |
      +----------------------+
      |                      |
      v                      v
 GameUIProvider         PhaserGame
      |                      |
      v                      v
 React overlays       Phaser scenes/entities
```

### React owns presentation

The React layer is centered around:

- `GameUIContext.tsx`
- `GameUI.tsx`
- UI components under `src/components/`

React owns:

- current screen
- active modal
- problem input
- decision question
- options
- recommendation
- door interaction state
- challenge
- evaluation
- waiting state
- errors
- trophy summary/document

### Phaser owns the world

Phaser owns:

- maps
- player movement
- camera
- collision
- door objects
- elevator
- trophy
- interaction detection
- scene transitions

This separation prevents large UI panels from becoming entangled with tilemap/game-world logic.

## 8. Phaser Scene Lifecycle

### BootScene

`BootScene`:

- loads common, decision, and trophy assets
- initializes player animations
- creates `WebSocketClient`
- creates `SessionStore`
- connects to the server
- restores sessions when a session ID already exists
- chooses the correct gameplay scene based on server state

Restore path:

```text
Browser reload
    |
    v
sessionStorage session ID
    |
    v
/ws?session_id=<sid>
    |
    v
SESSION_RESUMED
    |
    v
SessionStore.hydrate()
    |
    +--> CommonRoomScene
    +--> DecisionRoomScene
    +--> TrophyScene
```

### CommonRoomScene

The Common Room is the starting area.

It owns:

- map/player setup
- elevator interaction
- problem submission
- waiting for the first decision
- transition into the Decision Room

Submitting the problem sends `PROBLEM_SUBMITTED`.

### DecisionRoomScene

This is the core gameplay scene.

It owns:

- decision map
- player movement
- collision
- one door per server-provided option
- door proximity
- door open/close state
- optional context collection
- option submission
- challenge/evaluation state
- rendering subsequent decisions
- transition to Trophy Room

The skill determines the **number and meaning** of doors. Phaser determines their physical placement.

### TrophyScene

The Trophy Room renders the completed session.

It:

- loads the trophy map
- positions the player and trophy
- detects trophy interaction
- passes final session content to React

## 9. React ↔ Phaser Bridge

The bridge is implemented in `apps/game/src/game/GameBridge.ts`.

Phaser emits UI events through:

```text
game.events.emit("devquest:ui", event)
```

React subscribes to the event stream.

Representative events include:

- `GAME_LOADING`
- `GAME_READY`
- `COMMON_ROOM_READY`
- `DECISION_ROOM_READY`
- `ELEVATOR_OPEN`
- `DOOR_PROXIMITY`
- `DOOR_CONTEXT`
- `CHALLENGE`
- `EVALUATION`
- `NEXT_DECISION_LOADING`
- `SESSION_COMPLETE`
- `TROPHY_INTERACTED`
- `ERROR`

The reverse direction uses scene methods from React callbacks:

```text
React ElevatorModal
    -> CommonRoomScene.submitProblem()

React DoorContextModal
    -> DecisionRoomScene.confirmDoorSelection()
```

## 10. Client Networking

`apps/game/src/net/WebSocketClient.ts` owns the browser WebSocket connection.

Key behaviors:

- stores the active session ID in `sessionStorage`
- passes the session ID during reconnect
- retries with exponential backoff
- publishes parsed server messages to subscribers
- exposes explicit connect/disconnect methods

The frontend protocol is centralized in `apps/game/src/net/protocol.ts`.

## 11. Protocol

### Game → Server

| Message | Purpose |
|---|---|
| `PROBLEM_SUBMITTED` | Submit the engineering problem |
| `OPTION_SELECTED` | Select a decision option and optional context |
| `CHALLENGE_RESPONSE` | Submit the defense |
| `RECONSIDER` | Create a reconsideration branch |
| `CONTINUE` | Continue interaction |

### Server → Game

| Message | Purpose |
|---|---|
| `SESSION_STARTED` | New session |
| `SESSION_RESUMED` | Reconstructed session |
| `DECISION_CREATED` | New decision and options |
| `CHALLENGE` | Challenge the selected choice |
| `EVALUATION` | Feedback and consequence |
| `SESSION_COMPLETE` | Final session result |
| `ERROR` | Surface an error |

The protocol keeps transport explicit and leaves engineering semantics in the skill/domain layer.

## 12. End-to-End Flow

### Start

```text
/devquest <topic>
       |
       v
Claude Code skill
       |
       v
Game + FastAPI
       |
       v
BootScene
       |
       v
WebSocket
       |
       v
SESSION_STARTED / SESSION_RESUMED
```

### Problem submission

```text
Player
  |
  v
Common Room
  |
  v
Elevator
  |
  v
PROBLEM_SUBMITTED
  |
  v
SessionService
  |
  +--> DecisionEngine
  |
  +--> Player event queue
  |
  v
Skill polling / long-polling
```

### Decision creation

The skill calls:

```http
POST /api/skill/decisions
```

with:

- `session_id`
- `question`
- `options`
- optional `recommendation`
- `round`
- optional `depends_on`

The server records the node and pushes `DECISION_CREATED`.

### Option selection

```text
DecisionRoomScene
    |
    | OPTION_SELECTED
    v
WebSocket
    |
    v
SessionService
    |
    +--> DecisionEngine.choose()
    |
    +--> player event queue
    |
    v
Skill
```

The skill then generates a challenge.

### Challenge and defense

The skill posts:

```http
POST /api/skill/challenge
```

The server sends `CHALLENGE`.

The player responds through React.

The game sends `CHALLENGE_RESPONSE`.

The skill evaluates the defense and posts:

```http
POST /api/skill/evaluation
```

The server sends `EVALUATION`.

### Next decision

The skill can create another decision:

```text
POST /api/skill/decisions
        |
        v
DECISION_CREATED
        |
        v
DecisionRoomScene
```

The Decision Room can therefore represent multiple stages of the same reasoning session without knowing the engineering content.

### Finish

The skill calls:

```http
POST /api/skill/finish
```

The server pushes `SESSION_COMPLETE`.

The game transitions to `TrophyScene`.

## 13. Skill-Facing API

The API is implemented in `apps/server/app/api/skill_routes.py`.

### Player events

```http
GET /api/skill/events/pending
GET /api/skill/events/pending/long-poll
```

Long polling allows the skill to wait for a player action without busy-looping.

### Skill outputs

```http
POST /api/skill/decisions
POST /api/skill/challenge
POST /api/skill/evaluation
POST /api/skill/finish
```

### Session inspection

```http
GET /api/skill/sessions
GET /api/skill/sessions/{session_id}
```

### Health

```http
GET /api/health
```

## 14. Event Queue Architecture

Player actions are stored in per-session `asyncio.Queue` objects held by `SessionService`.

```text
Game WebSocket
      |
      v
handle_game_message()
      |
      v
_player_events[session_id]
      |
      v
Skill polling / long polling
```

Skill output flows in the opposite direction:

```text
Skill HTTP API
      |
      v
SessionService
      |
      v
ConnectionManager
      |
      v
Game WebSocket
```

This decouples the browser's interaction timing from the skill's polling cycle.

## 15. Session Resume and Reconnection

Session continuity is built into the client/server contract.

The browser stores:

```text
devquest_session_id
```

in `sessionStorage`.

On reconnect:

1. the client sends the session ID on the WebSocket query string
2. the server loads the existing session
3. the server sends `SESSION_RESUMED`
4. `SessionStore.hydrate()` reconstructs client state
5. `BootScene` chooses the scene matching the authoritative phase
6. pending WebSocket messages can be replayed

This means the browser is a **projection** of server session state rather than the sole source of truth.

## 16. Client State Ownership

### SessionStore

`apps/game/src/state/SessionStore.ts` stores session/domain data:

- session ID
- problem
- current node
- decision records
- round count
- completion state
- summary
- final document

It can hydrate from a `SessionSnapshot`.

### GameUIContext

`apps/game/src/state/GameUIContext.tsx` stores presentation state:

- active screen
- active modal
- current question
- options
- recommendation
- proximity prompts
- challenge
- evaluation
- waiting message
- errors
- trophy summary

### Ownership boundary

```text
Server/session semantics -> SessionStore
UI presentation         -> GameUIContext
World/gameplay           -> Phaser scene state
```

## 17. Game State Machine

Gameplay phases are defined in `apps/game/src/state/GameState.ts`.

```text
MENU
  |
  v
GATE_INPUT
  |
  v
WAITING_FOR_QUESTION
  |
  v
EXPLORING_DOORS
  |
  v
DOOR_CONTEXT
  |
  v
SHOWING_EVALUATION
  |
  +------> EXPLORING_DOORS
  |
  v
TROPHY
```

Not every phase is a separate Phaser scene. Several are transient scene states with React-rendered overlays.

## 18. Decision Graph

The system models a decision graph rather than a flat questionnaire.

### Sequential chain

```text
Node 1 -> Node 2 -> Node 3
```

### Reconsideration

```text
Node 1 -> Node 2
            |
            +-> Node 2'
```

The original node remains preserved and is marked `RECONSIDERED`.

This supports final documents that retain decision history instead of overwriting earlier choices.

### Dependencies

Decision creation supports `depends_on`.

```text
Decision A
    |
    | depends_on
    v
Decision B
```

The skill can use this relationship to make later questions explicitly depend on earlier architecture choices.

## 19. Game World and Tilemap Architecture

The frontend loads Tiled/Phaser maps in `BootScene`.

Map-specific modules under `src/tilemaps/` define:

- tilemap keys and paths
- tilesets
- map dimensions/bounds
- spawn positions
- collision layers
- interaction coordinates

The major areas are:

- Common Room
- Decision Room
- Trophy Room

Keeping map configuration separate from scene orchestration makes world changes less invasive.

## 20. Production Packaging

The backend can serve built game assets when its static directory exists.

The intended packaging flow is:

```text
Vite build
   |
   v
built game assets
   |
   v
server static directory
   |
   v
FastAPI StaticFiles
```

This permits a combined deployment in which the same FastAPI process serves both the API and the built game.

## 21. Technology Stack

### Frontend/game

- TypeScript
- React
- Phaser 4
- Vite
- Vitest

### Backend

- Python 3.12+
- FastAPI
- Uvicorn
- Pydantic / Pydantic Settings
- SQLAlchemy
- SQLite
- WebSockets
- Typer

### Tooling

- npm
- uv
- Make
- Tiled map assets

## 22. Configuration

Backend configuration is defined in `apps/server/app/config.py`.

Environment variables use the `DEVQUEST_` prefix, including settings for:

- host
- port
- database path
- game URL
- debug mode

Frontend configuration uses Vite variables:

- `VITE_WS_URL`
- `VITE_API_URL`
- `VITE_SHOW_DEV_TOOLBAR`

Typical development endpoints are:

```text
Game:   http://localhost:5173
Server: http://127.0.0.1:8000
WS:     /ws on the configured game/server origin
```

## 23. Architectural Invariants

### The skill owns engineering reasoning

Do not hard-code architectural recommendations into Phaser scenes.

### The server owns session continuity

The browser should be able to reconstruct a meaningful session from authoritative server state.

### Phaser owns the world

Movement, doors, map geometry, collision, and scene transitions belong in Phaser.

### React owns overlays

Question panels, inputs, challenge/evaluation displays, waiting states, and the final document UI belong in React.

### Cross-component behavior uses explicit protocol/events

New integration behavior should normally be represented by a typed protocol or bridge event rather than hidden coupling.

### Decision history is preserved

Reconsideration must preserve the previous decision node.

### The game does not determine correctness

The recommendation may be displayed, but engineering evaluation comes from the skill.

## 24. Extension Points

### Reasoning layer

The skill/API boundary allows the decision engine and game to evolve independently of the underlying reasoning workflow.

### Persistence

The SQLAlchemy-backed relational model can be moved to another relational database without changing the core frontend protocol.

### New game worlds

Additional Phaser scenes/maps can be introduced without changing the decision protocol.

### Analytics

The decision graph provides a basis for:

- decision counts
- reconsideration counts
- branches
- evaluation history
- session completion metrics

### Repository-aware interviews

The skill can inspect repository code and feed repository-specific constraints into the same decision/challenge/evaluation loop.

## 25. Testing Strategy

### Frontend

Vitest can exercise:

- protocol handling
- state transitions
- client-side helpers
- UI state behavior

### Backend

Pytest can exercise:

- decision graph behavior
- session lifecycle
- API routes
- player event queues
- WebSocket behavior
- persistence

### Domain isolation

The decision graph is deliberately free from web-framework dependencies, making core decision behavior independently testable.

## 26. Local Development

Typical setup:

```bash
make install
make dev
```

Individual services:

```bash
make dev-game
make dev-server
```

Testing:

```bash
make test
make test-game
make test-server
```

Database operations:

```bash
make db-migrate
make db-revision msg="describe your change"
```

## 27. Architecture at a Glance

```text
                         +----------------------+
                         |    Claude Code       |
                         |    DevQuest Skill    |
                         +----------+-----------+
                                    |
                              Skill REST API
                                    |
                                    v
+------------------------------------------------------------------+
|                         FastAPI Server                            |
|                                                                  |
|  +----------------+   +----------------+   +-----------------+  |
|  | Skill API      |   | SessionService |   | WebSocket       |  |
|  | /api/skill/*   +-->| orchestration  +-->| ConnectionMgr   |  |
|  +----------------+   +--------+-------+   +--------+--------+  |
|                                |                     |           |
|                                v                     |           |
|                        +---------------+             |           |
|                        | DecisionEngine|             |           |
|                        +-------+-------+             |           |
|                                |                     |           |
|                                v                     v           |
|                        +---------------+        WebSocket /ws    |
|                        | DecisionGraph|                           |
|                        +-------+-------+                          |
|                                |                                  |
|                                v                                  |
|                        +---------------+                          |
|                        | SQLite/ORM    |                          |
|                        +---------------+                          |
+-----------------------------------------------+------------------+
                                                |
                                                v
                                  +-------------------------------+
                                  | React + Phaser Client        |
                                  |                               |
                                  | React UI + GameUIContext     |
                                  |                               |
                                  | BootScene                    |
                                  | CommonRoomScene              |
                                  | DecisionRoomScene            |
                                  | TrophyScene                  |
                                  | SessionStore                 |
                                  | WebSocketClient               |
                                  +-------------------------------+
```

## 28. Summary

DevQuest is a **three-layer interactive decision system**:

1. **Reasoning layer** — Claude Code skill
2. **Session/transport layer** — FastAPI + decision engine + persistence
3. **Experience layer** — React + Phaser

The architecture is intentionally asymmetric: the game is visually rich but domain-light, while the skill is domain-rich but presentation-light. FastAPI connects the two through explicit HTTP and WebSocket contracts while keeping session state authoritative.

The resulting interaction loop is:

```text
Problem
  -> Decision
  -> Door
  -> Defense
  -> Challenge
  -> Evaluation
  -> Consequence
  -> Next Decision
  -> Trophy
```
