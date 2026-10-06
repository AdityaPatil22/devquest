# DevQuest Claude Code Plugin

DevQuest is distributed as a Claude Code plugin.

## Plugin Structure

The plugin is defined under:

```text
plugin/
├── .claude-plugin/
│   └── plugin.json
├── scripts/
│   ├── install.sh
│   └── start.sh
└── skills/
    └── devquest/
        └── SKILL.md
```

## Install

Add the marketplace:

```bash
claude plugin marketplace add AdityaPatil22/devquest
```

Install the plugin:

```bash
claude plugin install devquest@devquest
```

## Start

Start DevQuest with:

```text
/devquest
```

Or provide a topic:

```text
/devquest Should we migrate this service from Node.js to Go?
```

To resume an existing session:

```text
/devquest resume
```

## Runtime

The runtime consists of:

```text
apps/server → FastAPI → http://127.0.0.1:8000
apps/game   → Vite/Phaser → http://localhost:5173
```

The plugin startup script is responsible for starting the required services and making the game available locally.

The normal integrated startup flow is:

```text
Start backend
    ↓
Verify /api/health
    ↓
Start frontend
    ↓
Verify http://localhost:5173
    ↓
Open game
    ↓
Create or resume session
    ↓
Run the session event loop
```

## Runtime Scripts

### install.sh

The installation script validates the required toolchain, installs frontend dependencies, installs backend dependencies, and builds the game.

### start.sh

The startup script handles the integrated local runtime, including:

- FastAPI startup,
- health checks,
- frontend startup,
- frontend readiness checks,
- process tracking,
- cleanup.

## Skill Responsibilities

The DevQuest skill is responsible for the engineering reasoning.

It must:

- understand the engineering problem,
- inspect repository context when available,
- identify meaningful decisions,
- generate exactly four options,
- provide trade-offs and recommendations,
- use the player's selected option and context,
- determine the next meaningful decision,
- determine when enough information exists,
- generate the final implementation plan.

The skill must not move engineering reasoning into the Phaser client.

## Session Lifecycle

A session preserves one `session_id` from start to finish.

The event loop continues while the player is:

- selecting doors,
- moving through Corridors,
- entering Options Rooms,
- waiting for a new decision,
- waiting for the final document.

The session ends only when:

- the session is complete,
- the user explicitly ends DevQuest,
- the session becomes unrecoverable.

## Process Cleanup

Processes started by the plugin should be cleaned up when the DevQuest session ends or startup fails.

Cleanup must not terminate unrelated processes.

## Skill and Game Boundary

```text
Claude Code
   │
   │ engineering decisions
   ▼
FastAPI
   │
   │ typed session events
   ▼
Game
```

Claude does not decide:

- player position,
- room placement,
- door coordinates,
- collision geometry,
- camera behavior,
- rendering.

The game does not decide:

- which engineering questions matter,
- which option is best,
- when enough reasoning has been done,
- what the final implementation plan should contain.

## Updating the Plugin

Update an installed plugin with:

```bash
claude plugin update devquest@devquest
```

Uninstall with:

```bash
claude plugin uninstall devquest@devquest
```
