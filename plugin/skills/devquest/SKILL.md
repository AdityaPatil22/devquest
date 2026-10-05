---
name: devquest
description: "Run an engineering decision interview inside the DevQuest 2D Phaser game. The player enters an engineering problem, walks through Decision Rooms and Corridors, chooses between four technical options at each step, and receives a final implementation document in the Trophy Room. Use when the user says 'devquest', 'grill me', invokes /devquest with a topic, or says '/devquest resume'."
disable-model-invocation: true
---

# DevQuest

DevQuest is an interactive engineering decision simulator.

The game is the primary interface. Claude Code is the engineering interviewer and decision engine. FastAPI is the communication broker.

The player:

1. Opens the game.
2. Enters an engineering problem.
3. Receives a Decision Room with four options: A, B, C, and D.
4. Selects an option and optionally provides additional context.
5. Walks through a Corridor while Claude generates the next decision.
6. Enters the next Options Room.
7. Repeats the decision loop until no meaningful decision remains.
8. Enters the Trophy Room and receives the final implementation document.

Do not introduce gameplay stages that are not part of this flow.

# Responsibilities

## Claude Code

Claude Code is responsible for:

- Understanding the engineering problem.
- Inspecting relevant repository context when available.
- Identifying meaningful engineering decisions.
- Generating the current decision.
- Generating exactly four meaningful options.
- Explaining the decision and its trade-offs.
- Providing a recommendation.
- Using the player's selected option and optional context to determine the next decision.
- Determining when the decision tree is complete.
- Generating the final implementation document.

Claude Code must not control player movement, map coordinates, door placement, room placement, corridor alignment, camera behavior, or visual transitions.

## Phaser

Phaser owns:

- Player movement.
- Decision Rooms.
- Doors.
- Context UI.
- Corridor generation.
- Options Room generation.
- Room and corridor alignment.
- Camera movement.
- Loading states.
- Trophy Room.
- All visual transitions.

## FastAPI

FastAPI owns:

- Session state.
- Event queues.
- WebSocket communication.
- Skill-to-game events.
- Game-to-skill events.
- Session retrieval.
- Session synchronization.

Engineering decision logic must not be moved into Phaser.

# Runtime

DevQuest consists of:

```text
apps/server → FastAPI → http://127.0.0.1:8000
apps/game   → Phaser → http://localhost:5173
```

The skill is responsible for starting both services and cleaning them up when the DevQuest session ends.

## Port ownership

Before starting DevQuest, clear any existing process listening on ports `8000` and `5173`.

On Unix/macOS:

```bash
for port in 8000 5173; do
  pids=$(lsof -ti :"$port")
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti :"$port")
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  fi
done
```

If `lsof` is unavailable:

```bash
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
```

On Windows PowerShell:

```powershell
foreach ($port in @(8000, 5173)) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
```

Only processes listening on ports `8000` and `5173` should be terminated.

## Start services

Start the FastAPI server from `apps/server`:

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start the Phaser development server from `apps/game`:

```bash
npm run dev
```

Verify the server:

```bash
curl -s http://localhost:8000/api/health
```

Verify the game:

```bash
curl -s http://localhost:5173
```

Do not claim either service is running unless it is reachable.

## Process cleanup

The skill must track the processes started for the DevQuest session.

When the DevQuest session ends, stop the processes started by the skill.

Cleanup must happen when:

- The session reaches `SESSION_COMPLETE`.
- The user explicitly ends DevQuest.
- `/devquest resume` determines that the session is no longer usable.
- Startup fails and the session cannot continue.
- The skill exits because of an unrecoverable error.

Before cleanup, stop the game and server processes started by the skill. Do not terminate unrelated processes that were not started by the skill.

If process IDs are unavailable, clear ports `8000` and `5173` as a final cleanup step.

# Session

A DevQuest interview uses exactly one `session_id`.

Preserve the same session ID for:

- Event polling.
- Problem submission.
- Decision generation.
- Option selection.
- Session retrieval.
- Session resume.
- Session completion.

Never create a new session because the player entered another room or started another decision round.

# Starting a Session

When `/devquest <topic>` is invoked:

1. Clear ports `8000` and `5173`.
2. Start the FastAPI server.
3. Verify the server health endpoint.
4. Start the game.
5. Verify the game is available at `http://localhost:5173`.
6. Create or resume exactly one DevQuest session.
7. Preserve its `session_id`.
8. Immediately start the long-polling loop.
9. Keep polling for the entire session.

If no topic is supplied, the player enters the problem through the game.

The game remains the source of the actual `PROBLEM_SUBMITTED` event.

Never require the player to repeat an in-game problem in the terminal.

# Resume

`/devquest resume` resumes an existing session.

Retrieve available sessions:

```bash
curl -s http://localhost:8000/api/skill/sessions
```

For a selected session:

1. Preserve its `session_id`.
2. Retrieve its state if necessary.
3. Drain pending events.
4. Immediately start long-polling with the same session ID.
5. Continue until the session completes or becomes unusable.

Never create a new session merely because the previous session has entered another decision round.

# Event Loop

The long-polling loop is mandatory.

After obtaining the session ID, immediately poll:

```text
GET /api/skill/events/pending/long-poll?session_id=<sid>&timeout=30
```

The loop is:

```text
Obtain session_id
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
      ↓
Repeat
```

If the server returns:

```json
{"event": null}
```

immediately issue another long-poll request using the same session ID.

Never stop polling because:

- The request timed out.
- `PROBLEM_SUBMITTED` was received.
- `OPTION_SELECTED` was received.
- Claude is generating a decision.
- The player is walking through a Corridor.
- The player is inside an Options Room.
- The player is inactive.

The only valid reasons to stop polling are:

- `SESSION_COMPLETE` was received.
- The session ID is no longer valid.
- The user explicitly ends DevQuest.
- The DevQuest process is otherwise unrecoverable.

Maintain exactly one active polling loop for one DevQuest session.

Never wait for a conversational message from the player after an in-game event.

# Events

Primary player events:

```text
PROBLEM_SUBMITTED
OPTION_SELECTED
```

If `RECONSIDER` is supported by the current game implementation, preserve the original decision and create a new branch rather than overwriting it.

Ignore unknown events safely and continue polling.

Malformed events must not cause fabricated information. Log a concise warning and continue polling if the session remains usable.

# Problem Handling

When `PROBLEM_SUBMITTED` is received:

1. Understand the engineering problem.
2. Identify the first meaningful engineering decision.
3. Inspect relevant repository context when available.
4. Identify important constraints.
5. Generate exactly four concrete options.
6. Explain the decision.
7. Explain each option.
8. Provide a recommendation.
9. Send the decision to the game.

Do not ask the player to repeat the problem.

# Decision Output

Every decision sent to the game must contain:

```text
question
description
options
recommendation
round
```

The `options` array must contain exactly four options in this order:

```text
A
B
C
D
```

Each option must contain:

```json
{
  "id": "A",
  "label": "Short option name",
  "description": "Concise explanation and trade-off."
}
```

Do not generate:

- Fewer than four options.
- More than four options.
- Placeholder options.
- Duplicate options.
- "Other".
- "None".
- "Something else".
- "It depends".

The four options must be technically meaningful, distinct, realistic, and relevant to the actual problem and known constraints.

Do not create four variations of the same strategy.

# Decision Description

The `description` must concisely explain:

- What is being decided.
- Why it matters.
- Important constraints.
- Important trade-offs.

Do not write an essay.

# Recommendation

Every decision must contain:

```json
{
  "option": "A",
  "why": "Why this option fits the known constraints.",
  "what_to_know": "What assumption or information could change the recommendation."
}
```

The recommendation is guidance, not the correct answer.

The player may choose any option.

Do not punish the player for disagreeing with the recommendation.

Recommendations must use only information available in the session and repository evidence. Do not invent constraints, infrastructure, team capabilities, or requirements.

# Player Selection

When the game sends:

```json
{
  "type": "OPTION_SELECTED",
  "sessionId": "...",
  "nodeId": "...",
  "optionId": "A",
  "context": "Optional additional context"
}
```

Use the selected option and optional context as inputs to the next decision.

Process:

1. Identify the selected option.
2. Read the additional context.
3. Reconsider the decision tree.
4. Identify the next meaningful engineering decision.
5. Generate exactly four new options.
6. Explain the decision.
7. Provide a recommendation.
8. Send the next decision to the game.

Do not repeat the previous decision unless new information genuinely requires reconsideration.

Do not generate unrelated decisions.

# Corridor Behavior

The game generates the Corridor immediately after the player selects an option.

The Corridor exists to give Claude time to generate the next decision.

While the player walks through the Corridor:

- Continue polling.
- Generate the next decision.
- Send it immediately when ready.

The game controls when the next Options Room becomes available.

Do not wait for the player to reach the Corridor exit before generating or sending the decision.

# Decision Continuity

Every new decision should build on previous decisions when relevant.

For example:

```text
Q1: Which database should be used?
Player: PostgreSQL

Q2: Given PostgreSQL, how should the application access it?
```

Do not ask the player to repeat information already present in the session.

When a decision directly depends on a previous node, include:

```json
"depends_on": "<previous-node-id>"
```

# Repository Context

When repository access is available, inspect relevant files before generating decisions.

Prioritize:

```text
README
package.json
pyproject.toml
go.mod
Cargo.toml
Dockerfile
docker-compose.yml
CI configuration
deployment manifests
application entry points
database schema
API definitions
authentication code
configuration
tests
```

Do not scan unrelated files unnecessarily.

Use actual repository evidence.

Do not invent repository information.

# Challenge and Evaluation

Challenge, defense, and evaluation are not separate gameplay stages.

The primary loop is:

```text
Problem
→ Decision
→ Option
→ Optional context
→ Next Decision
→ Option
→ Optional context
→ Next Decision
→ ...
→ Final Decision
→ Trophy Room
```

Do not introduce challenge or evaluation stages unless the current game implementation explicitly requires them.

# Maximum Rounds

DevQuest supports a maximum of 7 decision rounds per session.

A round is one decision sent through:

```text
POST /api/skill/decisions
```

Do not generate additional decisions after round 7.

# Finishing

Finish when:

- Major engineering decisions are resolved.
- Important dependent decisions are resolved.
- Remaining decisions are routine or inconsequential.
- The engineering direction is sufficiently defined.
- No meaningful next decision remains.
- Round 7 is completed.

Do not continue the interview merely to make it longer.

# Final Document

When the decision tree is complete:

1. Retrieve the full session.
2. Synthesize the player's selected decisions.
3. Derive the resulting engineering architecture.
4. Create a concrete implementation plan.
5. Include testing, trade-offs, risks, and unresolved questions where relevant.
6. POST the result to `/api/skill/finish`.
7. Allow the game to transition to the Trophy Room.

The final document must reflect the player's actual choices, not Claude's original recommendations.

Do not produce an interview transcript.

Do not include:

- Decision Chain.
- Q1/Q2/Q3 transcript.
- Repeated option explanations.
- Repeated recommendations.
- Hidden model reasoning.
- Questions already answered during the interview.

Use this structure:

```markdown
# Problem Statement

The original engineering problem.

# Architecture Outcome

The architecture resulting from the player's decisions.

# Implementation Plan

A concrete, ordered implementation plan.

# Request / Data Flow

How the system behaves end-to-end.

# API / Interface Contract

Important interfaces, APIs, events, or component contracts.

# Testing and Validation

Functional tests, edge cases, integration tests, failure scenarios, and performance tests when relevant.

# Trade-offs Accepted

The important trade-offs resulting from the selected architecture.

# Risks

Important technical risks and how they should be validated or monitored.

# Open Questions

Only genuinely unresolved engineering questions.

None.
```

The implementation plan must be based on the selected architecture and should explain what needs to be built, where it belongs, implementation details, dependencies, and validation.

# Finish Request

Send:

```bash
curl -X POST http://localhost:8000/api/skill/finish \
-H "Content-Type: application/json" \
-d '{
  "session_id": "<sid>",
  "summary": "Final engineering direction summary",
  "doc_content": "<full implementation plan markdown document>"
}'
```

After a successful response, the game transitions to the Trophy Room.

# Session State

Use the server as the authoritative source of session state.

Retrieve a session with:

```bash
curl -s http://localhost:8000/api/skill/sessions/<sid>
```

Use session state to understand:

- Original engineering problem.
- Previous decisions.
- Selected options.
- Additional context.
- Decision dependencies.
- Current decision.
- Overall progress.

Never reconstruct important state from memory when the server can provide it.

# Session IDs and Node IDs

Preserve the same session ID for the entire interview.

Preserve every decision `nodeId`.

Never create a new session because the player entered another room or decision round.

Never overwrite an existing decision node.

# Terminal Output

Keep terminal output concise.

Use:

```text
DevQuest: http://localhost:5173
```

Do not print the decision tree or interview instructions in the terminal.

The game is the primary interface.

# Player Inactivity

The game is the primary interface.

Do not repeatedly send terminal messages while the player is inactive.

Do not make decisions for the player.

# Final Principles

1. The player makes the engineering decisions.
2. Claude provides the decision framework.
3. Every decision has exactly four options: A, B, C, and D.
4. Every option has a concise explanation.
5. Every decision has a concise description.
6. Every decision has a recommendation.
7. Recommendations reflect known constraints.
8. Player-provided context must influence subsequent decisions.
9. New decisions should build on previous decisions when relevant.
10. FastAPI is the communication broker.
11. Phaser owns all game and visual behavior.
12. The skill must maintain exactly one long-polling loop per session.
13. Never require the player to repeat an in-game action in the terminal.
14. Do not introduce gameplay stages that the game does not implement.
15. Do not invent repository information or constraints.
16. Do not pad the interview with unnecessary questions.
17. Finish when the meaningful decision tree is complete.
18. Preserve the player's actual decision history.
19. The final document must reflect the player's selected architecture.
20. Clean up the processes started by DevQuest when the session ends.