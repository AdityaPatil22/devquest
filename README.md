# DevQuest

<p align="center">
  <strong>Turn engineering decisions into a playable experience.</strong>
</p>

<p align="center">
  DevQuest is an interactive engineering planning simulator built for Claude Code.
  It turns an ambiguous technical problem into a sequence of concrete decisions,
  then visualizes those decisions as a 2D game world.
</p>

<p align="center">
  <a href="https://github.com/AdityaPatil22/devquest">GitHub</a>
  ·
  <a href="https://github.com/AdityaPatil22/devquest/issues">Issues</a>
</p>

---

## 🎮 See DevQuest in Action

[▶️ **Watch the DevQuest demo**](https://github.com/AdityaPatil22/devquest/releases/download/1.0.0/devquest-demo.mp4)

> GitHub does not reliably render custom `<video>` embeds in repository READMEs, even when the video is hosted as a release asset. The link above opens the uploaded MP4 directly. citeturn573109search0turn573109search1

---

## What is DevQuest?

Technical decisions are rarely a single yes/no question.

A real engineering problem usually involves a chain of decisions:

- What architecture should we use?
- Which implementation strategy fits the constraints?
- What trade-offs are acceptable?
- What assumptions still need validation?
- Which decision should depend on the previous one?
- When do we have enough information to actually implement the solution?

DevQuest turns that process into a **playable decision journey**.

You enter an engineering problem, then move through a 2D world where technical alternatives become doors. You choose an option, optionally provide additional context, and continue through a dynamically built world while Claude generates the next meaningful decision.

The session ends with a **concrete implementation plan** in the Trophy Room.

---

# ✨ Why DevQuest?

DevQuest is designed around one idea:

> **The goal is not to ask more questions. The goal is to make the important engineering decisions clear enough to implement.**

Claude is responsible for the reasoning.  
The game is responsible for the experience.  
FastAPI connects the two and keeps the session state synchronized.

This means the game does not hard-code engineering answers. The options, recommendations, and next decisions come from the Claude Code skill.

---

# 🧭 How the Game Works

The current gameplay loop is:

```text
BootScene
   ↓
Enter engineering problem
   ↓
GrillingScene
   ↓
Decision Room
   ↓
Choose a door
   ↓
Provide optional context
   ↓
Corridor generated
   ↓
Walk through the Corridor
   ↓
Claude generates the next decision
   ↓
Options Room generated
   ↓
Choose another option
   ↓
Another Corridor
   ↓
Another Options Room
   ↓
Repeat
   ↓
Final meaningful decision
   ↓
Final implementation document
   ↓
🏆 Trophy Room
```

### 1. Boot

The game opens with the DevQuest interface.

Enter the engineering problem you want to work through.

Examples:

```text
Should we migrate this service from Node.js to Go?

How should we design authentication for a multi-tenant platform?

Should our application use a monolith or microservices?
```

### 2. Decision Room

Claude generates the first meaningful engineering decision.

Each decision contains exactly four options:

```text
A
B
C
D
```

Each option has:

- a short label
- a description
- engineering trade-offs

The recommendation is guidance rather than a required answer.

### 3. Choose a Door

Walk to the door representing the option you want to select.

Press **E** to interact.

The game records:

- the selected option
- the current decision
- optional context supplied by the player

That information is sent back to Claude.

### 4. Corridor

After choosing an option, the game immediately creates a Corridor connected to that door.

The Corridor has an important purpose: **Claude can generate the next decision while the player is moving through the world.**

The player does not need to sit in a loading screen waiting for the next question.

The exit remains blocked until the next decision is ready.

### 5. Options Room

Once Claude has generated the next decision, the corridor exit unlocks.

An Options Room is generated and aligned with the Corridor.

The player enters the room, sees the next four options, and continues the process.

This creates the continuous-world loop that defines the current version of DevQuest.

### 6. Finish

Claude decides when the engineering problem is sufficiently explored for implementation.

The skill then switches the session into final document generation.

The game transitions into the Trophy Room once the implementation plan is ready.

---

# 🏆 The Trophy Room

The final result is not just a conversation transcript.

DevQuest produces a structured implementation document based on the decisions made during the session.

The exact contents depend on the engineering problem, but the result is intended to capture the information required to move from:

```text
ambiguous problem
        ↓
defined constraints
        ↓
architecture decisions
        ↓
trade-offs
        ↓
implementation direction
```

The Trophy Room is the completion state of a DevQuest session.

---

# 🤖 Claude Code Integration

DevQuest is distributed as a **Claude Code plugin**.

> **Important:** DevQuest is currently designed for **Claude Code**, not as a regular Claude.ai web plugin. The installation and `/devquest` commands below are Claude Code commands.

Claude Code acts as the engineering planning partner and decision engine.

The plugin contains the DevQuest skill at:

```text
plugin/skills/devquest/SKILL.md
```

The skill is responsible for:

- understanding the engineering problem
- inspecting repository context when available
- identifying meaningful engineering decisions
- generating exactly four realistic alternatives
- explaining trade-offs
- providing a recommendation
- incorporating the player's selected option
- using optional player context
- deciding what should be explored next
- determining when enough information exists
- generating the final implementation plan

The Phaser application does **not** contain the engineering reasoning.

---

# 🚀 Install DevQuest for Claude Code

## Requirements

DevQuest currently expects:

- Claude Code
- Node.js
- npm
- Python 3.12+
- uv
- Make
- `curl`

The plugin's installer validates Node.js, npm, uv, and Python 3.12+.

## Install the marketplace

From Claude Code:

```bash
claude plugin marketplace add AdityaPatil22/devquest
```

Then install DevQuest:

```bash
claude plugin install devquest@devquest
```

## Start DevQuest

Start a session with:

```text
/devquest
```

Or provide the topic directly:

```text
/devquest Should we rewrite our authentication service in Go?
```

The skill starts the DevQuest runtime and tells you to open:

```text
http://localhost:5173
```

The game UI is where you enter the problem and continue the session.

## What happens after `/devquest`

The plugin starts the local runtime:

```text
Claude Code
   ↓
DevQuest skill
   ↓
FastAPI server
   ↓
Phaser/Vite game
   ↓
http://localhost:5173
```

You interact with the game in your browser while Claude continues processing the engineering session through the backend.

## Resume a session

Use:

```text
/devquest resume
```

The session ID is preserved and the existing session can be reconstructed from the authoritative server state.

## Update

```bash
claude plugin update devquest@devquest
```

## Uninstall

```bash
claude plugin uninstall devquest@devquest
```

---

# 🧑‍💻 Using DevQuest with Your Own Repository

DevQuest becomes more useful when the engineering problem is connected to the repository you are already working on.

For example:

```text
/devquest
```

Then describe a problem such as:

```text
We need to redesign the caching strategy for the API.
```

When repository context is available, the skill can inspect relevant project information and use that evidence while generating decisions.

The important distinction is:

- **Claude decides what should be considered.**
- **DevQuest visualizes those decisions.**
- **The player remains the final decision maker.**

---

# 🏗️ Architecture

DevQuest has three primary layers.

```text
┌──────────────────────────────┐
│        Claude Code           │
│       DevQuest Skill         │
│                              │
│ Engineering reasoning        │
│ Decision generation          │
│ Recommendations              │
│ Final implementation plan    │
└──────────────┬───────────────┘
               │
          HTTP / long-polling
               │
               ▼
┌──────────────────────────────┐
│          FastAPI             │
│                              │
│ Session management           │
│ Decision graph               │
│ Player event queue           │
│ WebSocket broker             │
│ Persistence                  │
└──────────────┬───────────────┘
               │
             WebSocket
               │
               ▼
┌──────────────────────────────┐
│       React + Phaser         │
│                              │
│ React overlays/UI            │
│ Phaser world                 │
│ Player movement              │
│ Doors                        │
│ Corridors                    │
│ Options Rooms                │
│ Trophy Room                  │
└──────────────────────────────┘
```

## Responsibility boundaries

### Claude Code

Owns the engineering intelligence.

### FastAPI

Owns communication and authoritative session state.

### React

Owns interface and overlays.

### Phaser

Owns the interactive world.

That separation is intentional.

---

# 🔄 Communication Model

There are two communication paths.

## Claude Skill → FastAPI

Claude communicates with FastAPI through skill-facing HTTP endpoints.

Player events are retrieved through:

```http
GET /api/skill/events/pending
GET /api/skill/events/pending/long-poll
```

Claude sends decisions through:

```http
POST /api/skill/decisions
```

When the final document is being generated:

```http
POST /api/skill/finish/generating
```

When the final implementation plan is ready:

```http
POST /api/skill/finish
```

Sessions can be inspected through:

```http
GET /api/skill/sessions
GET /api/skill/sessions/{session_id}
```

## Game → FastAPI

The browser connects through:

```text
/ws
```

The game sends events such as:

```text
PROBLEM_SUBMITTED
OPTION_SELECTED
```

The server sends events such as:

```text
SESSION_STARTED
SESSION_RESUMED
DECISION_CREATED
FINAL_DOCUMENT_GENERATING
SESSION_COMPLETE
ERROR
```

This keeps the reasoning workflow independent from the rendering layer.

---

# 🔁 Session Persistence and Resume

Session continuity is built into the runtime.

The server maintains the authoritative session state, including:

- current phase
- current decision
- decision history
- selected options
- problem
- summary
- final document

The browser stores the current session ID and reconnects using it.

When the browser reconnects:

```text
Browser
   ↓
WebSocket + session_id
   ↓
FastAPI
   ↓
Load authoritative session
   ↓
SESSION_RESUMED
   ↓
SessionStore hydration
   ↓
Restore correct game state
```

This means a browser refresh does not inherently create a brand-new DevQuest session.

---

# 🧠 Decision Graph

DevQuest models the planning process as a decision graph rather than a flat questionnaire.

Conceptually:

```text
Decision 1
   │
   ├── Selected A
   │      ↓
   │   Decision 2
   │
   └── Other alternatives remain part of the decision history
```

The backend supports relationships such as:

- parent decision
- dependency between decisions
- selected option
- branch
- sequence
- status

The system can therefore preserve how the final architecture was reached instead of keeping only the last answer.

---

# 🌍 Continuous Game World

One of the defining implementation details of the current game is the continuous world.

The game does not reset to a fresh scene between every decision.

Instead, it progressively builds:

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

- loading tilemaps
- positioning room segments
- aligning corridor entrances
- aligning corridor exits
- opening/closing passage markers
- maintaining collision
- expanding world bounds
- creating interactable corridor objects
- locking the corridor while Claude is processing
- unlocking the exit when the next decision is available

This is implemented primarily under:

```text
apps/game/src/scenes/grilling/
apps/game/src/tilemaps/
```

---

# 🎮 Frontend Architecture

The game is a hybrid **React + Phaser** application.

```text
React
  │
  ├── Game UI
  ├── Decision panels
  ├── Problem input
  ├── Context dialogs
  ├── Waiting states
  └── Trophy/document UI
          │
          │ bridge
          ▼
       Phaser
          │
          ├── Player
          ├── Maps
          ├── Doors
          ├── Corridors
          ├── Options Rooms
          └── Trophy Room
```

Important frontend modules include:

```text
apps/game/src/components/
apps/game/src/game/
apps/game/src/net/
apps/game/src/scenes/
apps/game/src/state/
apps/game/src/tilemaps/
```

### Game state

The current gameplay phases include:

```text
MENU
GATE_INPUT
WAITING_FOR_QUESTION
EXPLORING_DOORS
DOOR_CONTEXT
TRAVERSING_OPTION
CORRIDOR_PROCESSING
FINAL_DOCUMENT_GENERATING
TROPHY
```

---

# 🖼️ Maps and World Assets

Tiled/Phaser tilemaps are used for the major environments.

Current map configuration lives under:

```text
apps/game/src/tilemaps/
```

Important map modules include:

```text
decisionRoomTilemap.ts
corridorTilemap.ts
optionRoomTilemap.ts
trophyRoomTilemap.ts
```

The game loads corresponding assets from:

```text
apps/game/public/assets/
```

---

# 🖥️ Backend Architecture

The backend is a FastAPI application.

Main areas:

```text
apps/server/app/
├── api/
├── engine/
├── models/
├── services/
├── websocket/
├── cli.py
├── config.py
└── main.py
```

## API layer

```text
app/api/skill_routes.py
```

Handles communication from the Claude Code skill.

## Engine

```text
app/engine/
├── decision_graph.py
├── engine.py
├── events.py
└── session.py
```

Contains the decision/session domain logic.

## Session service

```text
app/services/session_service.py
```

Coordinates:

- sessions
- player event queues
- skill messages
- WebSocket communication
- session state

## WebSocket layer

```text
app/websocket/
├── handlers.py
└── manager.py
```

Responsible for connecting the browser and routing game events.

---

# 💾 Persistence

The current persistence layer uses SQLite and SQLAlchemy.

The model includes tables for:

```text
sessions
decision_nodes
options
decisions
evaluations
```

The database location can be configured with:

```text
DEVQUEST_DB_PATH
```

The default development location is:

```text
~/.devquest/sessions.db
```

---

# 🧰 Tech Stack

## Game / Frontend

- TypeScript
- React 19
- Phaser 4
- Vite
- Vitest

## Backend

- Python 3.12+
- FastAPI
- Uvicorn
- Pydantic
- Pydantic Settings
- SQLAlchemy
- Alembic
- SQLite
- aiosqlite
- WebSockets
- Typer

## Tooling

- npm
- uv
- Make
- Tiled tilemaps

---

# 📁 Repository Structure

```text
devquest/
├── .claude-plugin/
│   └── marketplace.json
│
├── apps/
│   ├── game/
│   │   ├── public/
│   │   │   └── assets/
│   │   └── src/
│   │       ├── components/
│   │       ├── dev/
│   │       ├── entities/
│   │       ├── game/
│   │       ├── net/
│   │       ├── scenes/
│   │       ├── state/
│   │       ├── tilemaps/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── styles.css
│   │
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
│
├── docs/
│   ├── CLAUDE.md
│   ├── architecture.md
│   ├── devquest-architecture.png
│   └── releasing.md
│
├── plugin/
│   ├── .claude-plugin/
│   │   ├── plugin.json
│   │   ├── scripts/
│   │   └── skills/
│   │       └── devquest/
│   │           └── SKILL.md
│   │
│   ├── scripts/
│   │   ├── install.sh
│   │   └── start.sh
│   └── skills/
│       └── devquest/
│           └── SKILL.md
│
├── .env.example
├── CHANGELOG.md
├── Makefile
└── README.md
```

---

# 🛠️ Local Development

You can develop DevQuest directly from the repository without installing the Claude Code plugin.

## 1. Clone

```bash
git clone https://github.com/AdityaPatil22/devquest.git
cd devquest
```

## 2. Configure environment

```bash
cp .env.example .env
```

Default development values are:

```text
Server:   http://127.0.0.1:8000
Game:     http://localhost:5173
Database: ~/.devquest/sessions.db
```

## 3. Install dependencies

```bash
make install
```

This runs:

```text
apps/game   -> npm install
apps/server -> uv sync
```

## 4. Start everything

```bash
make dev
```

Open:

```text
http://localhost:5173
```

---

# ▶️ Run Services Individually

### Game

```bash
make dev-game
```

### Server

```bash
make dev-server
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

---

# 📦 Build

Build the frontend:

```bash
cd apps/game
npm run build
```

Build the complete package from the repository root:

```bash
make build
```

The full build:

1. builds the Vite/Phaser application
2. removes the existing backend static directory
3. copies the frontend build into `apps/server/app/static`

FastAPI can then serve the generated game from the same application.

---

# 🧪 Testing

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

The backend test suite currently includes domain/engine coverage under:

```text
apps/server/tests/
```

---

# 🗄️ Database Commands

Apply migrations:

```bash
make db-migrate
```

Create a migration:

```bash
make db-revision msg="describe your change"
```

---

# ⚙️ Configuration

The example environment file defines:

```text
DEVQUEST_HOST=127.0.0.1
DEVQUEST_PORT=8000
DEVQUEST_DB_PATH=~/.devquest/sessions.db
DEVQUEST_GAME_URL=http://localhost:5173
```

The plugin runtime also supports:

```text
DEVQUEST_GAME_PORT
```

The frontend supports Vite configuration such as:

```text
VITE_WS_URL
VITE_API_URL
VITE_SHOW_DEV_TOOLBAR
```

---

# 🔌 Plugin Runtime

The plugin uses:

```text
plugin/scripts/install.sh
plugin/scripts/start.sh
```

## Installation script

The installer:

- validates required tooling
- installs game dependencies
- installs server dependencies
- builds the game

## Startup script

The startup script:

- checks whether the server is already available
- starts FastAPI when needed
- waits for the health endpoint
- starts the Vite game server
- waits for the frontend to become reachable
- prints the game URL
- cleans up processes on exit

Default runtime ports:

```text
FastAPI: 8000
Game:    5173
```

---

# 📚 Documentation

Architecture details:

- [Architecture](docs/architecture.md)
- [Claude / contributor guidance](docs/CLAUDE.md)
- [Release process](docs/releasing.md)

Plugin definition:

- [DevQuest skill](plugin/skills/devquest/SKILL.md)

---

# 🧩 Design Principles

### Claude owns the reasoning

The skill determines the engineering decisions, alternatives, recommendations, and final plan.

### The server owns session continuity

The browser is a projection of the server-side session state.

### Phaser owns the world

Movement, collision, maps, doors, corridors, and room alignment belong to Phaser.

### React owns presentation

Decision panels, inputs, overlays, progress states, and document presentation belong to React.

### Decisions should be meaningful

The system should spend time on decisions that materially affect the implementation instead of creating unnecessary rounds.

### Player choices are authoritative

The recommendation is advisory. The player can choose any technically meaningful option.

### The decision history matters

Earlier decisions should remain recoverable and available when later decisions depend on them.

---

# 🔭 What Could Come Next?

Potential future directions include:

- richer repository-aware planning
- more world interactions
- additional room types
- stronger decision-history visualization
- session analytics
- shareable decision documents
- more game worlds and themes
- richer multiplayer or collaborative planning
- additional model/backend integrations

---

# 🤝 Contributing

Contributions, experiments, bug reports, and gameplay ideas are welcome.

A typical workflow:

```bash
git checkout -b feature/my-change
make test
git commit -m "Add my change"
git push origin feature/my-change
```

Then open a pull request.

---

# 📄 License

DevQuest is licensed under the MIT License.

---

# 🔗 Repository

https://github.com/AdityaPatil22/devquest
