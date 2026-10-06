# DevQuest

<p >
  <strong>Turn engineering decisions into a playable experience.</strong>
</p>

<p >
  DevQuest is an interactive engineering planning game for Claude Code.
  It turns an ambiguous engineering problem into a sequence of meaningful decisions
  and lets you work through them inside a 2D game world.
</p>

## 🎮 See DevQuest in Action

<video src="https://github.com/user-attachments/assets/106921ac-e9d9-4bcd-b1fc-8ea15fad3792" width="100%" controls></video>

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

# ✨ Why DevQuest?

DevQuest is designed around one idea:

> **The goal is not to ask more questions. The goal is to make the important engineering decisions clear enough to implement.**

Claude is responsible for the reasoning.  
The game is responsible for the experience.  
FastAPI connects the two and keeps the session state synchronized.

This means the game does not hard-code engineering answers. The options, recommendations, and next decisions come from the Claude Code skill.

## 🧭 How It Works

```text
Engineering Problem
        ↓
   Decision Room
        ↓
     Choose
        ↓
     Corridor
        ↓
  Next Decision
        ↓
   Options Room
        ↓
     Choose
        ↓
      Repeat
        ↓
 Implementation Plan
        ↓
   🏆 Trophy Room
```

### 1. Enter a problem

Start with the engineering problem you want to work through.

For example:

```text
Should we migrate this service from Node.js to Go?
```

### 2. Choose a decision

Claude generates four meaningful technical options. Each option becomes a door in the Decision Room.

Walk to the door you want and press **E**.

### 3. Explore while Claude thinks

After your choice, a Corridor is generated.

You walk through the Corridor while Claude uses your decision and any additional context to generate the next meaningful decision.

### 4. Continue the decision journey

The next Options Room appears at the end of the Corridor.

You choose again, travel through another Corridor, and continue until the problem is sufficiently defined for implementation.

### 5. Get the final plan

The session ends in the Trophy Room with the implementation plan created from the decisions made during the game.

---

## 🤖 How to install and use with Claude Code

DevQuest is distributed as a **Claude Code plugin**.

Install it with:

```bash
claude plugin marketplace add AdityaPatil22/devquest
claude plugin install devquest@devquest
```

Then start a session:

```text
/devquest
```

Or provide the problem directly:

```text
/devquest Should we rewrite our authentication service in Go?
```

The game runs locally at:

```text
http://localhost:5173
```

DevQuest is currently designed for **Claude Code**, not as a regular Claude.ai web plugin.

### Resume a session

```text
/devquest resume
```

---

## ✨ Why DevQuest?

DevQuest separates the work into three simple responsibilities:

- **Claude** handles the engineering reasoning.
- **FastAPI** keeps the session synchronized.
- **Phaser** turns the decisions into a playable world.

The player remains the final decision maker. Claude's recommendation is guidance, not a forced answer.

---

## 📚 Documentation

| Document | Purpose |
|---|---|
| [Gameplay](docs/gameplay.md) | Current game flow and player experience |
| [Architecture](docs/architecture.md) | System architecture and component boundaries |
| [Development](docs/development.md) | Local setup, commands, build, and testing |
| [Networking](docs/networking.md) | WebSocket, polling, and API contracts |
| [Persistence](docs/persistence.md) | Sessions, database, and resume behavior |
| [Plugin](docs/plugin.md) | Claude Code plugin and runtime behavior |
| [Contributor guidance](docs/CLAUDE.md) | Repository guidance for Claude and contributors |
| [Release process](docs/releasing.md) | Release workflow |

---

## 🧑‍💻 Local Development

Clone the repository:

```bash
git clone https://github.com/AdityaPatil22/devquest.git
cd devquest
```

Install dependencies:

```bash
make install
```

Start the game and server:

```bash
make dev
```

Open:

```text
http://localhost:5173
```

More detailed development instructions are in [docs/development.md](docs/development.md).

---

## 🏗️ Repository Structure

```text
devquest/
├── apps/
│   ├── game/       # React + Phaser application
│   └── server/     # FastAPI backend
├── docs/           # Technical documentation
├── plugin/         # Claude Code plugin and skill
├── .env.example
├── CHANGELOG.md
├── Makefile
└── README.md
```

---

## 🤝 Contributing

Contributions, experiments, bug reports, and gameplay ideas are welcome.

Before opening a pull request, run:

```bash
make test
```

See [docs/CLAUDE.md](docs/CLAUDE.md) for repository-specific contributor guidance.

---

## 📄 License

DevQuest is licensed under the MIT License.
