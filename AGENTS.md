# AGENTS.md

## Purpose

DevQuest is an interactive engineering planning simulator built as a Claude Code plugin, a FastAPI session broker, and a React + Phaser game.

The agent's job is to make focused changes without breaking the core boundary between:

- **Claude Code skill** — engineering reasoning and planning
- **FastAPI** — authoritative session state and transport
- **React** — interface and overlays
- **Phaser** — game world, movement, maps, collisions, and interactions

Before making broad architectural changes, read:

- `docs/architecture.md`
- `docs/CLAUDE.md`
- `plugin/skills/devquest/SKILL.md`

---

## Repository Layout

```text
devquest/
├── .claude-plugin/
│   └── marketplace.json
├── apps/
│   ├── game/
│   │   ├── public/assets/
│   │   └── src/
│   │       ├── components/
│   │       ├── dev/
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
│       │   ├── websocket/
│       │   ├── cli.py
│       │   ├── config.py
│       │   └── main.py
│       └── tests/
├── docs/
├── plugin/
│   ├── .claude-plugin/
│   ├── scripts/
│   └── skills/
├── .env.example
├── CHANGELOG.md
├── Makefile
└── README.md
```

---

# 1. Core Architecture

Use this ownership model unless there is a deliberate architectural change.

```text
Claude Code / DevQuest Skill
            │
            │ HTTP / long-polling
            ▼
        FastAPI Server
            │
            │ WebSocket
            ▼
       React + Phaser
```

### Claude Code owns

- engineering reasoning
- repository-aware analysis
- decision generation
- recommendations
- decision sufficiency
- final implementation planning

### FastAPI owns

- session lifecycle
- authoritative session state
- decision graph
- event queues
- skill-facing APIs
- WebSocket communication
- persistence

### React owns

- forms
- overlays
- panels
- status UI
- context dialogs
- waiting states
- final document presentation

### Phaser owns

- maps
- player
- movement
- camera
- collisions
- doors
- corridor generation
- option rooms
- world alignment
- gameplay interactions
- Trophy Room world

**Do not move engineering reasoning into Phaser.**

**Do not use React presentation state as the authoritative session model.**

**Do not make Claude responsible for map coordinates or collision geometry.**

---

# 2. Current Gameplay Flow

The current game is built around a continuous decision world:

```text
BootScene
   ↓
Enter engineering problem
   ↓
GrillingScene
   ↓
Decision Room
   ↓
Select a door
   ↓
Context UI
   ↓
OPTION_SELECTED
   ↓
Corridor generated
   ↓
Claude generates next decision
   ↓
Player walks through Corridor
   ↓
Next decision ready
   ↓
Options Room generated
   ↓
Player enters Options Room
   ↓
Select another door
   ↓
Repeat
   ↓
Final meaningful decision
   ↓
Final document generation
   ↓
Trophy Room
```

This flow is an architectural invariant.

Do not replace it with:

- a terminal questionnaire
- a chat-only workflow
- a fixed quiz
- a separate final interview
- a fixed round limit
- a standalone evaluation stage

The player should not need to repeat in-game actions in the terminal.

---

# 3. Decision Rules

Each generated decision contains exactly four options:

```text
A
B
C
D
```

Each option must be:

- technically meaningful
- distinct
- relevant to the actual problem
- realistic
- grounded in known constraints

Do not create:

- placeholder options
- duplicates
- "Other"
- "None"
- "Something else"
- "It depends"

The recommendation is advisory.

The player's selection is authoritative.

Never make the game reject a technically meaningful player choice merely because it disagrees with Claude's recommendation.

---

# 4. Decision Sufficiency

DevQuest is not intended to maximize the number of rounds.

Continue the decision loop when an unresolved decision could materially affect:

- architecture
- data model
- APIs
- service/component boundaries
- persistence
- authentication
- authorization
- event flow
- deployment
- testing
- scalability
- security
- performance
- user-facing workflow

Stop asking questions when remaining decisions are routine implementation details that can safely be captured in the final plan.

Do not:

- stop at an arbitrary round count
- continue merely to make the session longer
- invent unresolved questions just to create another room

---

# 5. Frontend Ownership

## React

Use React for:

- problem input
- decision information
- recommendation display
- context dialogs
- loading/waiting states
- errors
- decision history
- final summary/document UI

Important areas:

```text
apps/game/src/components/
apps/game/src/state/GameUIContext.tsx
apps/game/src/components/GameUI.tsx
```

## Phaser

Use Phaser for:

- game world
- tilemaps
- player
- movement
- collisions
- camera
- doors
- corridors
- option rooms
- world positioning
- interaction detection

Important areas:

```text
apps/game/src/scenes/
apps/game/src/entities/
apps/game/src/tilemaps/
apps/game/src/scenes/grilling/
```

## React ↔ Phaser bridge

The integration is handled through:

```text
apps/game/src/game/GameBridge.ts
```

Phaser emits UI events and React responds to them.

Typical flow:

```text
Phaser interaction
      ↓
GameBridge event
      ↓
React UI
      ↓
React callback
      ↓
Phaser scene method
```

Do not create hidden direct dependencies between unrelated React components and Phaser objects.

---

# 6. Session State

The server is the source of truth.

Client-side session data is represented by:

```text
apps/game/src/state/SessionStore.ts
```

Presentation state is represented by:

```text
apps/game/src/state/GameUIContext.tsx
```

Do not mix these responsibilities.

### SessionStore should represent

- session ID
- original problem
- current decision
- decisions
- selected options
- context
- round
- completion state
- summary
- final document

### GameUIContext should represent

- active screen
- current panel/modal
- visible recommendation
- waiting state
- current UI error
- decision-history presentation
- trophy presentation

---

# 7. Session Resume

Session resume is a core feature.

The browser stores the active session ID in:

```text
sessionStorage["devquest_session_id"]
```

The WebSocket reconnects with the session ID.

The server sends:

```text
SESSION_RESUMED
```

along with an authoritative snapshot.

The restore flow is:

```text
Browser reload
   ↓
sessionStorage
   ↓
WebSocket + session_id
   ↓
FastAPI loads session
   ↓
SESSION_RESUMED
   ↓
SessionStore.hydrate()
   ↓
Restore appropriate game state
```

Do not create a new session because the player:

- entered a Corridor
- entered an Options Room
- selected another option
- reached a later decision
- refreshed the browser

Preserve the same session ID throughout the entire planning session.

---

# 8. Network Protocol

Canonical protocol types live in:

```text
apps/game/src/net/protocol.ts
```

Before changing a network message, inspect both sides of the contract.

Current important game messages include:

```text
PROBLEM_SUBMITTED
OPTION_SELECTED
```

Server messages include:

```text
SESSION_STARTED
SESSION_RESUMED
DECISION_CREATED
FINAL_DOCUMENT_GENERATING
SESSION_COMPLETE
ERROR
```

Skill-facing HTTP endpoints are implemented in:

```text
apps/server/app/api/skill_routes.py
```

Relevant endpoints include:

```http
GET  /api/health
GET  /api/skill/events/pending
GET  /api/skill/events/pending/long-poll
POST /api/skill/decisions
POST /api/skill/finish/generating
POST /api/skill/finish
GET  /api/skill/sessions
GET  /api/skill/sessions/{session_id}
```

Preserve these identifiers:

```text
session_id
node_id
option_id
```

Do not silently rename or reinterpret protocol fields.

---

# 9. Long Polling

The Claude Code skill uses a long-polling loop to receive player actions.

Required behavior:

```text
Get session ID
   ↓
Long-poll
   ↓
Receive event
   ↓
Process event
   ↓
Perform required action
   ↓
Long-poll again
```

If the server responds with:

```json
{"event": null}
```

poll again immediately.

There should be exactly one active polling loop for a DevQuest session.

Do not stop polling because:

- a request timed out
- the player is walking through a Corridor
- Claude is generating a decision
- the player is in an Options Room
- final document generation has started

Valid stop conditions are limited to:

- session completion
- invalid session
- explicit user termination
- unrecoverable DevQuest failure

---

# 10. Continuous World

The continuous-world system is implemented primarily in:

```text
apps/game/src/scenes/grilling/
```

and:

```text
apps/game/src/tilemaps/
```

The world can contain:

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
```

The world manager is responsible for:

- loading room segments
- placing segments
- aligning entrances/exits
- maintaining world bounds
- creating collisions
- managing doors
- locking the Corridor exit
- unlocking the Corridor exit when the next decision is ready

The skill must never manage tile coordinates.

---

# 11. Corridor Gating

After a player selects an option:

1. create the Corridor immediately
2. send `OPTION_SELECTED`
3. let Claude generate the next decision
4. keep the Corridor exit blocked while processing
5. unlock the exit when the next decision arrives
6. build the Options Room
7. continue gameplay

The player should not be able to bypass the generated decision by walking through the locked exit.

Do not remove the exit lock merely to hide timing problems.

---

# 12. Tilemap Rules

Tilemap configuration lives in:

```text
apps/game/src/tilemaps/
```

Important files include:

```text
decisionRoomTilemap.ts
corridorTilemap.ts
optionRoomTilemap.ts
trophyRoomTilemap.ts
```

Map assets live under:

```text
apps/game/public/assets/
```

When changing:

- map dimensions
- tile size
- room origin
- player spawn
- collision layer
- markers
- doors
- corridor entrance/exit

inspect both the TypeScript configuration and the Tiled/JSON asset.

Do not assume a map JSON change automatically updates the TypeScript configuration.

---

# 13. Camera Rules

Camera behavior is Phaser-owned.

For player-follow gameplay:

```ts
this.cameras.main.startFollow(this.player.sprite, ...);
```

For a static/small room:

```ts
this.cameras.main.stopFollow();
this.cameras.main.centerOn(...);
```

When a world appears misaligned or cropped, inspect:

- camera follow state
- camera bounds
- physics world bounds
- segment origin
- tilemap bounds
- viewport/canvas dimensions
- React overlays/z-index

before changing map coordinates blindly.

---

# 14. Input Handling

Primary interaction is:

```text
E
```

Typical behavior:

```text
E near a door     → open context UI
E near trophy     → open trophy UI
```

When React text inputs are active, Phaser keyboard handlers must not interfere with DOM input.

Do not globally capture keyboard events in Phaser when a DOM text field is focused.

---

# 15. Backend Architecture

Backend code lives under:

```text
apps/server/app/
```

### API

```text
app/api/
```

Skill-facing routes belong here.

### Engine

```text
app/engine/
```

Contains domain-level decision/session logic.

Important files:

```text
decision_graph.py
engine.py
events.py
session.py
```

### Services

```text
app/services/session_service.py
```

This coordinates sessions, events, skill communication, and WebSockets.

### WebSocket

```text
app/websocket/
```

Contains:

- connection management
- browser message handling
- session reconnection
- pending message replay

### Models

```text
app/models/database.py
```

Current persistence uses:

```text
SQLite + SQLAlchemy
```

---

# 16. Decision Graph

The backend models a graph rather than a flat list.

A decision can have:

- parent
- dependency
- sequence
- selected option
- status
- branch history

When reconsidering a decision, preserve the historical node.

Do not overwrite an existing decision just because the player changed direction.

Conceptually:

```text
Decision A
   ↓
Decision B
   ↓
Decision C

Reconsider B

Decision A
   ↓
Decision B
   └── Decision B'
         ↓
      Decision C'
```

The decision history should remain explainable in the final document.

---

# 17. Final Document

The final document is an implementation plan, not merely a transcript.

It should reflect the player's actual decisions and repository evidence.

It should explain, where relevant:

- problem statement
- goals/non-goals
- architecture
- current system
- implementation steps
- data model
- APIs/interfaces
- request/data flow
- component changes
- edge cases
- error handling
- security
- performance/scalability
- testing
- deployment
- accepted trade-offs
- risks
- genuinely unresolved questions

Do not substitute Claude's original recommendation for the player's selected option.

Do not fabricate constraints or repository details.

Before finalizing, verify that no unresolved decision would materially change the implementation.

---

# 18. Claude Skill

The skill lives at:

```text
plugin/skills/devquest/SKILL.md
```

The skill is responsible for:

- repository-aware engineering planning
- decision generation
- recommendations
- receiving player choices
- deciding what should be explored next
- deciding when the solution is sufficient
- final implementation document generation

When repository context is available:

1. inspect relevant files
2. identify real constraints
3. make decisions based on evidence
4. reference concrete files/modules in the final plan

Do not invent repository facts.

Do not ask the player for information that can be reliably established from the repository.

---

# 19. Runtime / Plugin Scripts

The Claude Code plugin contains:

```text
plugin/scripts/install.sh
plugin/scripts/start.sh
```

The installer:

- checks required tools
- installs frontend dependencies
- installs backend dependencies
- builds the application

The startup script:

- verifies/starts FastAPI
- waits for `/api/health`
- starts the Vite game
- waits for the frontend to become reachable
- prints the game URL
- cleans up processes it started

Default ports:

```text
FastAPI: 8000
Game:    5173
```

Do not kill unrelated processes.

If port cleanup is necessary, restrict it to the DevQuest ports.

---

# 20. Development Commands

Prefer the existing Makefile.

## Install

```bash
make install
```

## Run all

```bash
make dev
```

## Frontend

```bash
make dev-game
```

## Backend

```bash
make dev-server
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

## Build

```bash
make build
```

## Database migration

```bash
make db-migrate
```

## New migration

```bash
make db-revision msg="describe your change"
```

## Clean

```bash
make clean
```

Health endpoint:

```bash
curl -s http://127.0.0.1:8000/api/health
```

---

# 21. Local Configuration

Environment variables use the `DEVQUEST_` prefix.

Current important values include:

```text
DEVQUEST_HOST
DEVQUEST_PORT
DEVQUEST_DB_PATH
DEVQUEST_GAME_URL
DEVQUEST_GAME_PORT
```

Frontend configuration may include:

```text
VITE_WS_URL
VITE_API_URL
VITE_SHOW_DEV_TOOLBAR
```

Prefer configuration variables over hard-coded environment-specific URLs.

Do not commit secrets.

---

# 22. Testing Strategy

### Frontend

Use Vitest for:

- protocol behavior
- state helpers
- UI behavior
- client-side logic

### Backend

Use Pytest for:

- decision graph
- session lifecycle
- API behavior
- event queues
- WebSocket behavior
- persistence-related behavior

When changing a protocol or state machine, add or update tests around the changed path.

Do not rely only on manual browser testing for changes to:

- session lifecycle
- protocol contracts
- decision graph behavior
- finalization
- reconnection

---

# 23. Change Workflow

Before editing:

1. Identify which layer owns the behavior.
2. Inspect the current implementation.
3. Inspect adjacent protocol/state code if the change crosses a boundary.
4. Check tests covering the behavior.
5. Make the smallest coherent change.
6. Run targeted tests.
7. Run the full test suite when practical.

When a behavior is crossed between components, update both sides of the contract.

Example:

```text
New server message
    ↓
protocol.ts
    ↓
WebSocket handling
    ↓
scene/state handling
    ↓
React UI if needed
```

Do not patch only the visual symptom when the authoritative state is wrong.

---

# 24. Common Failure Modes

## React overlay survives a scene transition

Check:

- `GameUIContext`
- `GameUI.tsx`
- emitted Phaser UI events
- modal visibility flags

A Phaser scene transition does not automatically clear React state.

## Player cannot leave Corridor

Check:

- `corridorReady`
- Corridor exit blocker
- next `DECISION_CREATED`
- unlock logic
- player collision

## Next decision appears too early

Check:

- pending decision handling
- Corridor generation timing
- whether the exit is locked until `DECISION_CREATED`

## Session resets after refresh

Check:

- `sessionStorage`
- WebSocket query `session_id`
- `SESSION_RESUMED`
- server snapshot creation
- `SessionStore.hydrate()`

## Game receives a stale decision

Check:

- `nodeId`
- `round`
- duplicate `DECISION_CREATED` handling
- current decision in `SessionStore`

## Doors are visually misaligned

Check:

- tilemap origin
- door anchors
- tile size
- map bounds
- world segment position
- camera coordinates

Do not fix a world-coordinate bug with arbitrary UI offsets.

---

# 25. Important Invariants

Treat these as high-priority invariants.

1. One DevQuest planning session uses one `session_id`.
2. The server is authoritative for session state.
3. The skill owns engineering reasoning.
4. Phaser owns the game world.
5. React owns presentation.
6. The game is not the source of engineering correctness.
7. Player choices are authoritative.
8. Decision history must be preserved.
9. Reconsideration must not overwrite history.
10. Every decision currently has four options: A, B, C, D.
11. Corridor generation happens immediately after option selection.
12. The Corridor exit stays locked until the next decision is ready.
13. Options Rooms are generated only when the corresponding decision exists.
14. There is no fixed maximum number of decision rounds.
15. Final document generation happens only after the final meaningful decision.
16. Final document generation is not a separate gameplay interview.
17. The Trophy Room is the completion destination.
18. Only one active skill long-polling loop should exist per session.
19. The player should not be forced to repeat in-game actions in the terminal.
20. Repository facts must come from repository evidence.
21. Do not hard-code engineering recommendations into Phaser.
22. Do not use UI state as a substitute for authoritative session state.
23. Keep protocol changes synchronized across client/server/skill boundaries.
24. Do not terminate unrelated developer processes during cleanup.
25. Preserve the continuous Decision Room → Corridor → Options Room experience.

---

# 26. Scope Discipline

Prefer:

```text
smallest change that fixes the actual layer owning the problem
```

Avoid:

- unrelated refactors
- broad formatting changes
- renaming working APIs without necessity
- changing map architecture just to fix one alignment issue
- moving domain logic into UI code
- replacing existing abstractions without a concrete reason
- changing protocol structures without updating all consumers

When modifying working code, preserve existing formatting and structure unless the requested change requires otherwise.

---

# 27. Documentation Expectations

When adding a major architectural capability, update the relevant documentation:

- `README.md` for user-facing behavior
- `docs/architecture.md` for architecture
- `docs/CLAUDE.md` for repository-specific development guidance
- `plugin/skills/devquest/SKILL.md` for skill behavior

Keep documentation aligned with the actual current implementation.

Do not document legacy gameplay as current behavior.

---

# 28. Definition of Done

A change is complete when:

- the correct layer owns the new behavior
- related protocol/state contracts are updated
- the main gameplay flow still works
- session state is preserved
- relevant tests pass
- no unrelated processes are affected
- user-facing documentation is updated when behavior changes
- no fabricated repository assumptions were introduced

For gameplay changes, manually verify at least:

```text
Boot
→ Problem
→ Decision Room
→ Door
→ Context
→ Corridor
→ Next Decision
→ Options Room
→ Repeat
→ Final Document
→ Trophy Room
```

For session changes, also verify:

```text
Start
→ Refresh
→ Reconnect
→ Restore correct state
→ Continue
```
