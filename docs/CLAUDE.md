# CLAUDE.md — DevQuest Repository Context

## Purpose

DevQuest is an AI-powered engineering decision simulator presented as a 2D game.

The user enters an engineering problem, chooses between technical options represented by doors, defends the choice when challenged, receives an evaluation, and eventually gets a final engineering decision document.

### Core architecture

```text
Claude Code / DevQuest Skill
            |
            | HTTP
            v
      FastAPI Server
      - session state
      - decision graph
      - player event queues
      - skill API
      - WebSocket broker
            |
            | WebSocket
            v
    React + Phaser Game
    - React UI/overlays
    - Phaser world/scenes
    - player movement
    - doors/maps/collision
```

**Critical rule:** the skill owns engineering reasoning; FastAPI owns the session/transport boundary; Phaser owns the game world; React owns overlay UI.

Read `architecture.md` for the fuller architectural reference before making broad structural changes.

---

# 1. Repository Layout

```text
devquest/
├── apps/
│   ├── game/                      # React + Phaser frontend
│   │   ├── public/assets/         # Game assets, tilemaps, sprites
│   │   └── src/
│   │       ├── components/        # React UI
│   │       ├── dev/               # Dev-only tooling
│   │       ├── entities/          # Phaser entities
│   │       ├── game/              # Phaser bootstrap + Phaser/React bridge
│   │       ├── net/               # WebSocket client + protocol types
│   │       ├── scenes/             # Phaser scenes
│   │       ├── state/              # Session/UI/game state
│   │       └── tilemaps/           # Map-specific configuration
│   │
│   └── server/                    # FastAPI backend
│       ├── app/
│       │   ├── api/               # Skill-facing HTTP endpoints
│       │   ├── engine/            # Domain model / decision graph
│       │   ├── models/            # SQLAlchemy models
│       │   ├── services/          # Session orchestration
│       │   ├── websocket/         # WebSocket endpoint/manager
│       │   ├── cli.py
│       │   ├── config.py
│       │   └── main.py
│       └── tests/
│
├── plugin/
│   └── skills/
│       └── devquest/
│           └── SKILL.md           # Claude Code skill behavior
│
├── architecture.md                # Detailed architecture documentation
├── Makefile
├── .env.example
└── README.md
```

---

# 2. Important Files

## Frontend

### `apps/game/src/main.tsx`
React application entry point.

### `apps/game/src/App.tsx`
Composes:

- `GameUIProvider`
- `PhaserGame`
- `GameUI`
- optional `DevToolbar`

### `apps/game/src/game/`
Phaser bootstrap and integration with React.

Important bridge:

```text
apps/game/src/game/GameBridge.ts
```

Phaser emits UI events with:

```ts
game.events.emit('devquest:ui', event)
```

React listens to those events.

### `apps/game/src/net/protocol.ts`
Canonical TypeScript definitions for the game/server WebSocket protocol.

Do not invent message names or fields when changing network behavior. Update the protocol types deliberately.

### `apps/game/src/net/WebSocketClient.ts`
Browser WebSocket client.

Responsibilities:

- connect/disconnect
- session ID persistence
- reconnect
- message dispatch

The active session ID is stored in:

```text
sessionStorage["devquest_session_id"]
```

### `apps/game/src/state/SessionStore.ts`
Client-side representation of the authoritative session.

Contains:

- session ID
- problem
- current node
- decisions
- round count
- completion state
- summary
- final document

`hydrate(snapshot)` restores it from the server session snapshot.

### `apps/game/src/state/GameUIContext.tsx`
React presentation state.

Contains things like:

- current screen
- active modal
- current question/options
- recommendation
- challenge
- evaluation
- waiting state
- errors
- trophy summary

Do not use this as a replacement for `SessionStore`.

### `apps/game/src/state/GameState.ts`
Gameplay phase enum.

Current phases include:

```text
MENU
GATE_INPUT
WAITING_FOR_QUESTION
EXPLORING_DOORS
DOOR_CONTEXT
WAITING_FOR_CHALLENGE
RESPONDING_TO_CHALLENGE
WAITING_FOR_EVALUATION
SHOWING_EVALUATION
TROPHY
```

## Phaser scenes

### `apps/game/src/scenes/BootScene.ts`

Responsible for:

- loading assets
- initializing player animations
- creating `WebSocketClient`
- creating `SessionStore`
- connecting to the backend
- restoring a session after reload
- routing into the correct scene based on session state

`BootScene` is the session restoration entry point.

### `apps/game/src/scenes/CommonRoomScene.ts`

Responsible for:

- Common Room map
- player
- elevator interaction
- problem submission
- waiting for the first decision

Problem submission eventually sends:

```text
PROBLEM_SUBMITTED
```

A received `DECISION_CREATED` transitions to `DecisionRoomScene`.

### `apps/game/src/scenes/DecisionRoomScene.ts`

Core gameplay scene.

Responsible for:

- Decision Room map
- player movement
- collisions
- dynamic door creation
- one door per option
- door proximity
- door open/close state
- optional context collection
- option selection
- challenge/defense state
- evaluation state
- rendering later decisions
- transition to Trophy Room

Important:

**The skill supplies the option list. Phaser only decides where/how to render the doors.**

### `apps/game/src/scenes/TrophyScene.ts`

Responsible for:

- Trophy Room map
- trophy interaction
- final summary/document handoff to React

---

# 3. React vs Phaser Ownership

Use this boundary strictly.

## Phaser owns the game world

- maps
- sprites
- player movement
- camera
- collision
- proximity detection
- doors
- elevator/trophy objects
- scene transitions
- gameplay phase

## React owns UI overlays

- forms
- modal dialogs
- challenge input
- evaluation panel
- waiting overlays
- error messages
- HUD
- final document/summary

Typical interaction:

```text
Phaser detects interaction
        |
        v
GameBridge event
        |
        v
React renders UI
        |
        v
React callback
        |
        v
Active Phaser Scene method
```

Examples:

```text
React ElevatorModal
    -> CommonRoomScene.submitProblem()

React DoorContextModal
    -> DecisionRoomScene.confirmDoorSelection()

React ChallengePanel
    -> DecisionRoomScene.submitDefense()
```

Do not move large React overlays into Phaser unless there is a strong reason.

---

# 4. Backend Architecture

## `apps/server/app/main.py`

FastAPI entry point.

Registers:

```text
/api/*
/ws
```

Initializes the database on startup.

## `apps/server/app/services/session_service.py`

Main orchestration layer.

Coordinates:

```text
Game WebSocket
      |
      v
SessionService
   |       |
   v       v
Engine   Player Event Queue
   |
   v
WebSocket Manager
```

It handles:

- session lifecycle
- player events
- skill-generated events
- skill/game message translation

## `apps/server/app/engine/decision_graph.py`

Core domain model.

Important types:

```text
DecisionGraph
DecisionNode
Option
Recommendation
Decision
Evaluation
NodeStatus
```

Node statuses include:

```text
PENDING
ACTIVE
DECIDED
CHALLENGED
EVALUATED
RECONSIDERED
```

The graph is not merely a list of questions.

It supports:

- parent relationships
- dependencies
- sequence ordering
- reconsideration branches

### Reconsideration

A reconsideration must preserve the original node.

Conceptually:

```text
Node A
  |
  v
Node B  <--- original
  |
  +---- Node C

Reconsider B
  |
  v
Node B' <--- new branch
```

Do not overwrite the historical decision.

---

# 5. Persistence

Current backend persistence is:

```text
SQLite + SQLAlchemy
```

Main model relationships:

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

Main file:

```text
apps/server/app/models/database.py
```

Important distinction:

- `DecisionGraph` = current in-memory domain representation
- SQLAlchemy models = persistence representation

Keep domain logic independent from FastAPI/web concerns where practical.

---

# 6. Network Protocol

Canonical client-side protocol:

```text
apps/game/src/net/protocol.ts
```

## Game -> Server

```text
PROBLEM_SUBMITTED
OPTION_SELECTED
CHALLENGE_RESPONSE
RECONSIDER
CONTINUE
```

### `PROBLEM_SUBMITTED`

```ts
{
  type: 'PROBLEM_SUBMITTED';
  problem: string;
}
```

### `OPTION_SELECTED`

```ts
{
  type: 'OPTION_SELECTED';
  nodeId: string;
  optionId: string;
  context?: string;
}
```

### `CHALLENGE_RESPONSE`

```ts
{
  type: 'CHALLENGE_RESPONSE';
  nodeId: string;
  response: string;
}
```

## Server -> Game

```text
SESSION_STARTED
SESSION_RESUMED
DECISION_CREATED
CHALLENGE
EVALUATION
SESSION_COMPLETE
ERROR
```

### Important rule

Preserve:

- `sessionId`
- `nodeId`
- `optionId`

across the full lifecycle of a decision.

---

# 7. Skill API

The Claude Code skill talks to FastAPI through HTTP.

Defined in:

```text
apps/server/app/api/skill_routes.py
```

Endpoints:

```text
GET  /api/health

GET  /api/skill/events/pending
GET  /api/skill/events/pending/long-poll

POST /api/skill/decisions
POST /api/skill/challenge
POST /api/skill/evaluation
POST /api/skill/finish

GET  /api/skill/sessions
GET  /api/skill/sessions/{session_id}
```

Player actions travel:

```text
Game
  -> WebSocket
  -> SessionService
  -> per-session asyncio.Queue
  -> Skill polling/long-polling
```

Skill output travels:

```text
Skill
  -> HTTP API
  -> SessionService
  -> DecisionEngine
  -> WebSocket manager
  -> Game
```

---

# 8. Main Runtime Flow

## New session

```text
/devquest <topic>
       |
       v
Start/verify FastAPI
       |
       v
Start/verify game
       |
       v
Phaser BootScene
       |
       v
WebSocket connect
       |
       v
SESSION_STARTED
       |
       v
CommonRoomScene
```

## Problem -> decision

```text
Player
  |
  v
Common Room / Elevator
  |
  v
PROBLEM_SUBMITTED
  |
  v
FastAPI
  |
  v
Skill receives event
  |
  v
POST /api/skill/decisions
  |
  v
DECISION_CREATED
  |
  v
DecisionRoomScene
```

## Decision -> challenge -> evaluation

```text
Player chooses door
        |
        v
OPTION_SELECTED
        |
        v
Skill
        |
        v
CHALLENGE
        |
        v
Player defense
        |
        v
CHALLENGE_RESPONSE
        |
        v
Skill
        |
        v
EVALUATION
        |
        v
Next decision OR finish
```

## Completion

```text
POST /api/skill/finish
        |
        v
SESSION_COMPLETE
        |
        v
TrophyScene
```

---

# 9. Session Resume

Session resume is important and should not be broken casually.

Client:

```text
sessionStorage["devquest_session_id"]
```

Reconnect URL conceptually:

```text
/ws?session_id=<sid>
```

Server:

1. loads existing session
2. attaches WebSocket
3. sends `SESSION_RESUMED`
4. sends authoritative snapshot
5. replays pending WebSocket messages when applicable

Client:

1. `BootScene` receives the snapshot
2. `SessionStore.hydrate(snapshot)`
3. current phase is inspected
4. correct scene is started

Potential destinations:

```text
CommonRoomScene
DecisionRoomScene
TrophyScene
```

**Do not introduce client-only session truth that cannot be reconstructed from the server snapshot.**

---

# 10. Decision Room Rules

The Decision Room is generic.

The skill may send:

```json
{
  "options": [
    {"id": "A", "label": "PostgreSQL"},
    {"id": "B", "label": "MongoDB"},
    {"id": "C", "label": "DynamoDB"}
  ]
}
```

The game must render three doors.

Do not hard-code:

- the meaning of A/B/C
- how many doors there are
- which option is technically correct

The skill sends the recommendation separately.

The game may display the recommendation but must not reinterpret it.

### Door lifecycle

```text
EXPLORING_DOORS
      |
      v
player near door
      |
      v
DOOR_CONTEXT
      |
      v
OPTION_SELECTED
      |
      v
WAITING_FOR_CHALLENGE
      |
      v
CHALLENGE
      |
      v
CHALLENGE_RESPONSE
      |
      v
WAITING_FOR_EVALUATION
      |
      v
EVALUATION
      |
      v
next decision / finish
```

---

# 11. UI / Overlay Pitfall

The React UI is rendered above the Phaser canvas.

A common class of bugs in this repo is:

```text
Phaser world is loaded
BUT
React overlay/modal remains visible
```

When debugging transitions, inspect **both**:

1. Phaser scene state
2. React `GameUIContext` / active modal

A scene transition alone does not clear React UI state.

Important UI events include:

```text
ELEVATOR_CLOSED
DECISION_ROOM_READY
EXPLORING_DOORS
DOOR_CONTEXT
WAITING
CHALLENGE
EVALUATION
NEXT_DECISION_LOADING
SESSION_COMPLETE
```

When a scene changes, ensure the corresponding React state changes too.

---

# 12. Continuous World / Scene Transition Guidance

The game currently uses Phaser scenes for major areas.

Do not assume that:

```ts
scene.start('DecisionRoomScene')
```

creates a physically continuous world.

A Phaser scene transition replaces the active scene unless scenes are explicitly run in parallel.

Therefore, when working on the continuous-world experience:

- distinguish between **scene lifecycle** and **visual continuity**
- do not accidentally render two full rooms on top of each other
- do not add an overlay that hides the destination scene
- if using parallel scenes, reason explicitly about z-order and camera ownership
- if using a single-scene world generator, keep world segments under one scene instead of mixing that approach with unrelated scene starts

The current repository contains both scene-based gameplay architecture and ongoing work around generated/continuous rooms. Inspect the actual implementation before deciding which model is active on the branch you are modifying.

---

# 13. Tilemaps

Map-specific logic lives under:

```text
apps/game/src/tilemaps/
```

Typical responsibilities of a tilemap config module:

- tilemap key/path
- tile size
- tilesets
- collision layer names
- map bounds
- player spawn
- door/elevator/trophy positions

Tiled/JSON assets live under:

```text
apps/game/public/assets/
```

When changing map dimensions, spawn points, collision, or door placement, inspect both:

1. the map asset
2. the matching TypeScript tilemap configuration

Do not change only one side and assume the other updates automatically.

---

# 14. Cameras

Camera behavior is Phaser-specific.

Typical pattern:

### Player-follow room

```ts
this.cameras.main.startFollow(this.player.sprite, ...)
```

### Small static room

Use:

```ts
this.cameras.main.stopFollow()
this.cameras.main.centerOn(...)
```

If a room is unexpectedly offset, overlapping, or apparently hidden, inspect:

- camera follow state
- camera bounds
- world bounds
- scene position
- canvas dimensions
- React overlay z-index

before rewriting map coordinates.

---

# 15. Frontend Input

The main movement/input code is Phaser-side.

The primary interaction key is:

```text
E
```

Typical interactions:

```text
E near elevator -> open problem UI
E near door     -> open door context UI
E near trophy   -> open summary UI
```

When text inputs are open, make sure Phaser keyboard listeners are not interfering with DOM input.

Do not globally capture keyboard events in Phaser if a React input should receive them.

---

# 16. Build / Run / Test

## Install

```bash
make install
```

## Run everything

```bash
make dev
```

## Run frontend only

```bash
make dev-game
```

or:

```bash
cd apps/game
npm run dev
```

## Run backend only

```bash
make dev-server
```

or:

```bash
cd apps/server
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Health check

```bash
curl -s http://localhost:8000/api/health
```

## Test everything

```bash
make test
```

## Frontend tests

```bash
make test-game
```

## Backend tests

```bash
make test-server
```

## Frontend build

```bash
cd apps/game
npm run build
```

## Full build

```bash
make build
```

Before changing code, prefer the existing Makefile commands when they already provide the desired operation.

---

# 17. Dependency / Tooling Context

Frontend:

```text
React
Phaser 4
TypeScript
Vite
Vitest
npm
```

Backend:

```text
Python 3.12+
FastAPI
Uvicorn
Pydantic
SQLAlchemy
SQLite
WebSockets
Typer
uv
```

Repository-level workflow uses:

```text
Make
```

---

# 18. Configuration

Backend config:

```text
apps/server/app/config.py
```

Uses the `DEVQUEST_` environment-variable prefix.

Important settings:

```text
DEVQUEST_HOST
DEVQUEST_PORT
DEVQUEST_DB_PATH
DEVQUEST_GAME_URL
DEVQUEST_DEBUG
```

Frontend Vite variables include:

```text
VITE_WS_URL
VITE_API_URL
VITE_SHOW_DEV_TOOLBAR
```

Do not hard-code deployment-specific URLs when a config variable already exists.

---

# 19. Skill Behavior

The actual Claude Code behavior is defined in:

```text
plugin/skills/devquest/SKILL.md
```

The skill should:

- inspect repository context when relevant
- ask concrete engineering questions
- generate 2–4 realistic options
- provide a recommendation
- challenge meaningful decisions
- evaluate the player's defense
- follow dependencies between decisions
- surface contradictions
- preserve reconsidered branches
- stop when the meaningful decision tree is complete
- generate the final decision document

The skill should not invent repository facts.

When repository context is available, inspect real files before asking questions those files can answer.

---

# 20. Engineering Interview Rules

DevQuest is not a trivia quiz.

Prefer:

```text
Why is this architectural choice appropriate under the known constraints?
```

over:

```text
What command installs package X?
```

unless the command itself is architecturally relevant.

Durable decisions deserve deeper challenges:

- language/runtime
- database
- auth
- persistence model
- deployment architecture
- messaging
- public API
- service boundaries
- major framework choices

Routine implementation details should not consume many rounds.

---

# 21. Final Document

A finished session produces a Markdown engineering decision document.

It should preserve:

- original problem
- major decisions
- reasoning
- challenges
- defenses
- evaluations
- consequences
- reconsidered decisions
- architecture outcome
- accepted trade-offs
- risks
- open questions

Do not invent architecture in the final document.

The final document must reflect what the player actually decided.

---

# 22. Change Guidelines for Claude

Before editing:

1. Identify which layer owns the behavior.
2. Inspect the relevant current implementation.
3. Check whether the behavior crosses a protocol/bridge boundary.
4. Keep existing session semantics intact unless the task explicitly changes them.

When changing a network message:

1. update `apps/game/src/net/protocol.ts`
2. update backend message handling
3. update the skill-facing API if applicable
4. update bridge/UI behavior if applicable
5. test both directions

When changing a scene transition:

1. inspect current scene lifecycle
2. inspect React UI state
3. inspect WebSocket subscriptions
4. ensure the old scene unsubscribes/cleans up
5. ensure the destination scene receives required `SceneData`
6. make sure the React overlay does not remain stale

When changing session behavior:

1. update server state first
2. update `SessionSnapshot`/protocol as needed
3. update `SessionStore.hydrate()`
4. test reconnect/reload behavior

When changing doors/options:

1. keep option IDs stable
2. preserve option ordering
3. render exactly one door per option
4. do not hard-code engineering semantics into the game

---

# 23. Common Failure Modes

## Overlay hides the game

Inspect:

```text
GameUIContext
GameUI
styles.css
modal state
z-index
scene transition event
```

Do not assume Phaser failed to load.

## Destination scene appears behind another scene

Inspect:

```text
scene.start()
scene.launch()
active scenes
camera ownership
React overlay
```

Avoid running multiple full-screen world scenes unless parallel rendering is intentional.

## Session state disappears after reload

Inspect:

```text
WebSocketClient sessionStorage
SESSION_RESUMED
BootScene.restoreSession()
SessionStore.hydrate()
```

The server snapshot should be authoritative.

## Input key does not work

Check whether a DOM input is focused and consuming the event before changing Phaser input handling.

## Doors are wrong or misaligned

Check:

```text
DecisionCreatedMsg.options
DECISION_DOOR_ROW_X_RANGE
DECISION_DOOR_ROW_TILE_Y
DECISION_MAP_TILE_SIZE
door sprite origin/scale
```

## World/map looks offset

Check:

```text
camera follow
camera bounds
world bounds
map origin
tile size
scene canvas size
```

---

# 24. Do Not Do These Things

- Do not put engineering decision logic into Phaser.
- Do not invent protocol message types without updating both sides.
- Do not create duplicate WebSocket/session connections unnecessarily.
- Do not replace server-authoritative session state with client-only state.
- Do not destroy historical decisions when implementing reconsideration.
- Do not hard-code the number of decision doors.
- Do not assume a scene transition is a continuous physical world.
- Do not leave React modals open across scene transitions accidentally.
- Do not fabricate repository files, endpoints, or behavior.
- Do not broaden a small bug fix into an architectural rewrite unless necessary.
- Do not remove existing functionality merely to simplify a local change.

---

# 25. Preferred Debugging Order

When something is not working:

```text
1. Browser/console errors
2. React UI state
3. Phaser active scene
4. Phaser scene phase/state
5. WebSocket connection
6. WebSocket message payload
7. FastAPI logs
8. SessionService handling
9. DecisionEngine/DecisionGraph state
10. Persistence
```

For visual bugs:

```text
1. Scene active?
2. Camera correct?
3. Map loaded?
4. Object exists?
5. Object depth correct?
6. React overlay visible?
7. CSS/z-index correct?
```

For state bugs:

```text
1. Server authoritative state
2. WebSocket event
3. SessionStore
4. GameUIContext
5. Scene phase
```

---

# 26. Source of Truth Priority

When sources disagree, prefer:

```text
1. Current source code
2. Current protocol types
3. Current server API implementation
4. architecture.md
5. README.md
6. Older comments/examples
```

Documentation can lag implementation.

Do not blindly follow an outdated README statement if the source code clearly differs.

---

# 27. Before Finishing a Change

At minimum:

```text
- TypeScript changes compile
- Python changes import/parse correctly
- Relevant tests pass
- Network contracts match on both sides
- Scene cleanup still occurs
- React UI state is consistent with scene state
- Session resume still makes sense
```

For larger changes, run:

```bash
make test
```

and, when relevant:

```bash
make build
```

---

# 28. Useful Context Files

Before making a large change, read:

```text
architecture.md
README.md
plugin/skills/devquest/SKILL.md
```

Then inspect only the implementation files directly related to the requested change.

Do not scan the entire repository unnecessarily.

---

# 29. Mental Model

Think of DevQuest as:

```text
AI interviewer
      |
      v
decision graph
      |
      v
FastAPI session
      |
      v
WebSocket events
      |
      v
Phaser world <-> React UI
```

The game is a visualization and interaction surface for an engineering reasoning process.

The most important architectural boundary is:

```text
ENGINEERING INTELLIGENCE
        !=
GAME PRESENTATION
```

Keep that boundary intact.
