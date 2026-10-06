# DevQuest Networking

DevQuest uses two communication paths:

```text
Claude Code Skill
       │
       │ HTTP + long-polling
       ▼
    FastAPI
       ▲
       │ WebSocket
       │
 React + Phaser Game
```

## Game ↔ FastAPI WebSocket

The browser connects to:

```text
/ws
```

The WebSocket may include the current session ID so the server can resume an existing session.

### Client messages

The current core client messages are:

| Message | Purpose |
|---|---|
| `PROBLEM_SUBMITTED` | Submit the engineering problem entered in BootScene |
| `OPTION_SELECTED` | Submit the selected decision option and optional context |

### Server messages

| Message | Purpose |
|---|---|
| `SESSION_STARTED` | A new DevQuest session was created |
| `SESSION_RESUMED` | An existing session was restored |
| `DECISION_CREATED` | Claude created the next decision |
| `FINAL_DOCUMENT_GENERATING` | Final implementation document generation started |
| `SESSION_COMPLETE` | The final document and session are complete |
| `ERROR` | An error must be surfaced to the game |

## Session Snapshot

The session snapshot used for resume contains the authoritative session state, including:

```text
sessionId
problem
phase
round
currentNodeId
decisions
summary
docContent
```

The frontend hydrates its session store from this state.

## Skill → FastAPI

The Claude Code skill communicates through:

```http
GET /api/skill/events/pending
GET /api/skill/events/pending/long-poll?session_id=<sid>&timeout=30
POST /api/skill/decisions
POST /api/skill/finish/generating
POST /api/skill/finish
GET /api/skill/sessions
GET /api/skill/sessions/{session_id}
```

## Long Polling

Player events are exposed to Claude through polling endpoints.

The long-polling flow is:

```text
Game action
    ↓
FastAPI receives WebSocket event
    ↓
Session event queue
    ↓
Claude long-poll request
    ↓
Player event returned
    ↓
Claude generates next decision
    ↓
Decision posted to FastAPI
    ↓
FastAPI pushes DECISION_CREATED
    ↓
Game updates
```

The skill should maintain one active polling loop for one session.

A timeout that returns no event is not session completion. The same session should be polled again.

## Decision Contract

A decision sent to the game contains:

```text
session_id
question
description
options
recommendation
round
depends_on
```

The options array contains exactly four options in this order:

```text
A
B
C
D
```

Each option contains:

```json
{
  "id": "A",
  "label": "Short option name",
  "description": "Concise explanation and trade-off."
}
```

The recommendation contains:

```json
{
  "option": "A",
  "why": "Reasoning for the recommendation.",
  "whatToKnow": "Optional context."
}
```

## Final Document Flow

When Claude has determined that no further meaningful decision is required:

```text
POST /api/skill/finish/generating
          ↓
FINAL_DOCUMENT_GENERATING
          ↓
Document is prepared
          ↓
POST /api/skill/finish
          ↓
SESSION_COMPLETE
          ↓
Trophy Room
```

## Error Handling

The game should surface server errors instead of inventing missing decision data.

Unknown server messages should be handled safely so they do not break the session connection.

Malformed events should not be treated as valid decisions.

## Health Check

The server provides:

```http
GET /api/health
```

The integrated runtime should verify this endpoint before treating FastAPI as ready.
