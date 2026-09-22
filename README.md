# DevQuest

DevQuest is an interactive **AI-powered engineering decision simulator** that turns the process of making technical decisions into a 2D game.

Instead of answering questions in a terminal or chat window, you enter a problem at the **Gate**, walk through **Decision Rooms**, choose between architectural options represented by doors, defend your choices, and get challenged on your reasoning.

At the end of the session, DevQuest generates a structured **engineering decision document** that captures the decision chain, trade-offs, risks, and final architecture.

---

## Why DevQuest?

Technical decisions are rarely just about picking an option.

A good engineering decision requires you to:

- understand the problem and constraints
- evaluate multiple alternatives
- explain why you made a choice
- defend that choice under challenge
- understand consequences and trade-offs
- revisit decisions when new information appears
- document the final outcome

DevQuest turns that process into an interactive experience.

---

## 🎮 How It Works

The experience is divided into four areas:

### 1. Common Room

The starting point of the game.

From here you can begin a new session or resume an existing one.

### 2. Gate

The Gate is where the player enters the engineering problem they want to explore.

Example:

> **"Should we rewrite our authentication service in Go?"**

Once submitted, DevQuest starts building a decision tree around the problem.

### 3. Decision Room

Each decision becomes a room containing doors.

Every door represents a concrete engineering option.

Example:

```
Which implementation should we choose?

🚪 A  Go
🚪 B  Rust
🚪 C  Node.js
🚪 D  Python
```

The player walks to a door and selects an option.

The system then:

1. records the choice
2. challenges the reasoning
3. collects the player's defense
4. evaluates the answer
5. generates the next decision

The next question depends on the previous decision, creating a branching decision graph.

## Install DevQuest

DevQuest is distributed as a Claude Code plugin.

### Requirements

* Claude Code
* Node.js
* npm
* Python 3.12+
* [uv](https://docs.astral.sh/uv/)
* Make

### Install from GitHub

Add the DevQuest marketplace:

```bash
claude plugin marketplace add AdityaPatil22/devquest
```

Install the plugin:

```bash
claude plugin install devquest@devquest
```

Then start DevQuest from Claude Code:

```text
/devquest
```

You can also start a session around a specific engineering problem:

```text
/devquest Should we rewrite our authentication service?
```

### Updating DevQuest

After a new version is released:

```bash
claude plugin update devquest@devquest
```

To remove it:

```bash
claude plugin uninstall devquest@devquest
```


---

## Getting Started (For Local Development)

### Prerequisites

Install:

- **Node.js**
- **Python 3.12+**
- **uv**
- **Make**

### 1. Clone

```bash
git clone https://github.com/AdityaPatil22/devquest.git
cd devquest
```

### 2. Configure environment

Copy the example environment file:

```bash
cp .env.example .env
```

The default development configuration uses:

- Server: `127.0.0.1:8000`
- Game: `http://localhost:5173`
- SQLite database: `~/.devquest/sessions.db`

### 3. Install dependencies

```bash
make install
```

This installs:

- game dependencies with npm
- server dependencies with uv

---

## Run DevQuest

Start both the game and backend:

```bash
make dev
```

Then open:

```
http://localhost:5173
```

### Run services individually

#### Game

```bash
make dev-game
```

#### Server

```bash
make dev-server
```

The backend runs on:

```
http://127.0.0.1:8000
```

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

---

## Testing

Run the complete test suite:

```bash
make test
```

Game tests:

```bash
make test-game
```

Server tests:

```bash
make test-server
```

---

## Build

Build the game:

```bash
cd apps/game
npm run build
```

Or build the full application:

```bash
make build
```

The full build compiles the Phaser application and copies the generated game assets into the server's static directory.

---


### 4. 🏆 Trophy Room

When the decision tree is complete, DevQuest generates a final engineering document.

The document includes:

- Problem Statement
- Summary
- Decision Chain
- Reasoning
- Challenges and Defenses
- Evaluations
- Consequences
- Architecture Outcome
- Accepted Trade-offs
- Risks
- Open Questions

The completed document becomes the player's **trophy**.

---

## 🏗️ Architecture

DevQuest consists of three primary pieces:

```
                    ┌─────────────────────┐
                    │    DevQuest Skill   │
                    │                     │
                    │ Decision / Grilling │
                    │      Logic          │
                    └──────────┬──────────┘
                               │
                         HTTP / Polling
                               │
                               ▼
                    ┌─────────────────────┐
                    │    FastAPI Server   │
                    │                     │
                    │ Sessions            │
                    │ Decision Graph      │
                    │ Event Queue         │
                    │ WebSocket Broker    │
                    │ Persistence         │
                    └──────────┬──────────┘
                               │
                           WebSocket
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Phaser Game      │
                    │                     │
                    │ Common Room         │
                    │ Gate                │
                    │ Decision Rooms      │
                    │ Trophy Room         │
                    └─────────────────────┘
```

### Separation of responsibilities

**Skill**

Owns the engineering interview and decision-making logic.

**FastAPI server**

Acts as the broker between the skill and the game and manages sessions, decision state, events, and persistence.

**Phaser client**

Owns the interactive game experience and renders decisions as rooms and doors.

The game does **not** decide what an engineering option means. It simply renders the options provided by the skill.

---

## 🔄 Event Flow

The game and skill communicate through the FastAPI broker.

### Player → Server → Skill

Player actions include:

- problem submission
- option selection
- additional context
- challenge responses
- finish requests

### Skill → Server → Game

The skill sends:

- questions
- decision options
- recommendations
- challenges
- evaluations
- final documents

A simplified flow looks like:

```
Player
  │
  │ problem
  ▼
Gate
  │
  ▼
FastAPI
  │
  ▼
Skill
  │
  │ question + options
  ▼
FastAPI
  │
  ▼
Decision Room
  │
  │ choose door
  ▼
FastAPI
  │
  ▼
Skill
  │
  │ challenge
  ▼
Player
```

---

## Claude Code Integration

DevQuest is not a standalone web game. The game is the visual interface for a Claude Code skill.

When `/devquest` is invoked, the plugin coordinates three components:

```text
Claude Code
    │
    │ DevQuest Skill
    ▼
FastAPI Broker
    │
    │ WebSocket
    ▼
Phaser Game
```

### Claude Code skill

The skill acts as the engineering interviewer.

It is responsible for:

* understanding the engineering problem
* generating decision points
* presenting concrete alternatives
* challenging the selected option
* evaluating the player's reasoning
* determining the next decision
* producing the final engineering decision document

### FastAPI server

The backend acts as the communication broker.

It manages:

* sessions
* persistence
* player events
* skill events
* WebSocket communication
* decision state

### Phaser game

The game is responsible for the experience:

* movement
* rooms
* doors
* text input
* challenges
* evaluations
* trophy presentation

The game does not decide which engineering option is correct. It renders the decisions generated by the skill.

This separation allows the engineering reasoning to remain in Claude Code while the player interacts through a visual game.


---

## Decision-Grilling Model

DevQuest follows a branching decision-tree approach.

Each answer determines what should be discussed next.

For example:

```
Problem
│
├── Language
│   ├── Go
│   │   ├── HTTP framework
│   │   ├── Database driver
│   │   └── Error handling
│   │
│   └── Node.js
│       ├── Existing architecture
│       ├── Performance improvements
│       └── Migration strategy
│
├── Data migration
│
└── Rollback strategy
```

The system emphasizes:

- concrete engineering choices
- repository-aware reasoning when repository context is available
- durable decisions over routine implementation details
- dependencies between decisions
- challenging every selected option
- stopping once the meaningful decision tree has been explored

---

## Tech Stack

### Game

- **Phaser 4**
- **TypeScript**
- **Vite**
- **Vitest**
- Pixel-art 2D game assets
- WebSocket client

### Backend

- **Python 3.12+**
- **FastAPI**
- **Uvicorn**
- **SQLAlchemy**
- **Alembic**
- **Pydantic**
- **Pydantic Settings**
- **SQLite / aiosqlite**
- **WebSockets**
- **Typer**
- **Pytest**

### Development

- **npm**
- **uv**
- **Make**
- REST APIs
- WebSockets

---

## Project Structure

```
devquest/
├── apps/
│   ├── game/
│   │   ├── public/
│   │   │   └── assets/
│   │   └── src/
│   │       ├── scenes/
│   │       │   ├── BootScene.ts
│   │       │   ├── CommonRoomScene.ts
│   │       │   ├── GateScene.ts
│   │       │   ├── DecisionRoomScene.ts
│   │       │   └── TrophyScene.ts
│   │       ├── net/
│   │       │   ├── WebSocketClient.ts
│   │       │   └── protocol.ts
│   │       ├── state/
│   │       ├── entities/
│   │       ├── ui/
│   │       ├── tilemap.ts
│   │       ├── gateSceneTilemap.ts
│   │       ├── decisionRoomTilemap.ts
│   │       ├── tiles.ts
│   │       ├── config.ts
│   │       └── main.ts
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
├── .claude-plugin/
│   └── marketplace.json
│
├── .claude-plugin/
│   └── marketplace.json
│
├── Makefile
├── .env.example
└── README.md
```

## Database

Run database migrations:

```bash
make db-migrate
```

Create a new migration:

```bash
make db-revision msg="describe your change"
```

---

## Skill Integration

The `plugin/skills/devquest/SKILL.md` file contains the DevQuest skill definition.

It supports commands such as:

```
/devquest <topic>
/devquest resume
```

The skill communicates with the server using endpoints for:

- session management
- event polling
- decision creation
- challenges
- evaluations
- finishing sessions

The server exposes a long-polling event endpoint for skill interaction and WebSocket communication for the game.

---

## ⌨️ Game Controls

The game is designed around keyboard-driven movement and interaction.

The main gameplay loop is:

```
Explore
  ↓
Reach Gate
  ↓
Enter Problem
  ↓
Enter Decision Room
  ↓
Choose Door
  ↓
Defend Choice
  ↓
Receive Challenge
  ↓
Continue Decision Tree
  ↓
Reach Trophy Room
```

---

## Design Principles

### The skill owns the intelligence

The skill determines questions, options, challenges, evaluations, and when the decision tree is complete.

### The game owns the experience

Phaser handles movement, rooms, doors, interactions, transitions, and visual feedback.

### Decisions are contextual

Questions should build on previous decisions rather than behaving like a fixed questionnaire.

### Every decision gets challenged

Even a technically strong choice is tested against alternative constraints and counterarguments.

### Keep the interview focused

The goal is not to generate the maximum number of questions. The goal is to explore the meaningful decisions deeply.

---

## 🗺️ Current Game Areas

| Area | Purpose |
|---|---|
| **Common Room** | Main menu / starting area |
| **Gate** | Collect the engineering problem |
| **Decision Room** | Present and challenge engineering choices |
| **Trophy Room** | Present the final decision document |

---

## Future Possibilities

Potential extensions include:

- richer AI model integrations
- repository-aware decision analysis
- multiplayer decision sessions
- richer decision-tree visualization
- session history and analytics
- additional game worlds and environments
- achievements and progression
- shareable engineering decision reports
- more interactive NPCs and game mechanics

---

## Contributing

Contributions, ideas, bug reports, and experiments are welcome.

A typical workflow:

```bash
git checkout -b feature/my-change
# make changes
make test
git commit -m "Add my change"
git push origin feature/my-change
```

Then open a pull request.

---

## Continuous World Generation

The active gameplay world is kept inside a single persistent Phaser GameWorldScene. The flow is:

```
Common Room
    ↓
Gate / problem submission
    ↓
AI emits DECISION_CREATED
    ↓
Decision Room + doors
    ↓
Player selects a door
    ↓
Record option/context in SessionStore
    ↓
Append corridor + next random room
    ↓
Connect rooms with RoomManager connection points
    ↓
Extend physics + camera bounds
    ↓
Move player to the generated room entrance
    ↓
AI challenge → player defense → evaluation
    ↓
Next DECISION_CREATED updates the same decision room
    ↓
Repeat without resetting the world
```

Room creation is deferred: only the initial corridor/room pair is prepared up front, and later pairs are appended after a selection. WorldState, PlayerState, and DecisionState keep persistent gameplay state separate from rendering, while RoomGenerationState exposes idle → generating → ready/error lifecycle state.

Generated collision layers are attached to the player as each room is appended, and the physics/camera world bounds are extended with the latest room. Room placement and joins are owned by RoomManager, so successive rooms remain connected without recreating earlier areas.

For the end-to-end gameplay path, the game sends the selected optionId to the server, records it locally, waits for the server challenge/evaluation events, and replaces the doors with the next decision in the same scene. Errors during generation return the scene to decision exploration without discarding the already-built world.

## License

DevQuest is licensed under the MIT License.

---

## Repository

[DevQuest on GitHub](https://github.com/AdityaPatil22/devquest)
