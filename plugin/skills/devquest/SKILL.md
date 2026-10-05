---
name: devquest
description: "Run a collaborative engineering planning session inside the DevQuest 2D Phaser game. The player enters an engineering problem, works with Claude through Decision Rooms, Corridors, and Options Rooms, chooses between four technical options at each step, and receives a concrete implementation plan in the Trophy Room. Use when the user says 'devquest', 'grill me', invokes /devquest with a topic, or says '/devquest resume'."
disable-model-invocation: true
---

# DevQuest

DevQuest is an interactive engineering planning workspace presented through a 2D Phaser game.

Claude Code is the engineering planning partner and decision engine. FastAPI is the communication broker. Phaser owns the complete gameplay experience.

The game must preserve this exact gameplay flow:

```text
BootScene
   ↓
Player enters engineering problem
   ↓
GrillingScene
   ↓
Decision Room
   ↓
Player approaches a door
   ↓
Player presses E
   ↓
Context overlay
   ↓
Selected option + optional context sent to Claude
   ↓
Corridor generated and aligned with the selected Decision Room door
   ↓
Player walks through Corridor while Claude generates the next decision
   ↓
Next decision generated
   ↓
Options Room generated and aligned with the Corridor
   ↓
Player enters Options Room
   ↓
Player selects another option
   ↓
Another Corridor generated
   ↓
Player walks through Corridor while Claude generates the next decision
   ↓
Another Options Room generated
   ↓
Repeat
   ↓
Final meaningful decision
   ↓
Final implementation document generated
   ↓
Trophy Room
```

The Decision Room, Corridor, and Options Room loop is the core gameplay loop.

Do not replace this flow with a questionnaire, chat interface, terminal workflow, separate evaluation stage, challenge stage, or any other gameplay structure.

# Exact Gameplay Flow

## 1. BootScene

The initial game loads into `BootScene`.

`BootScene` contains:

- DevQuest branding.
- Game explanation.
- Game instructions.
- System status.
- Engineering problem input.

The player enters the engineering problem they want to work on in the right-side input box.

The player should not need to enter the same problem again in the terminal.

## 2. GrillingScene

After the player submits the engineering problem, the game transitions into `GrillingScene`.

The first generated environment contains only the initial Decision Room.

The Decision Room is generated from the four options supplied by Claude Code.

The options are represented by four doors:

```text
A
B
C
D
```

## 3. Selecting a Decision

The player walks to the option they want to select.

When the player presses `E`:

1. The selected door is identified.
2. The context overlay opens.
3. The player may provide additional context.
4. The selected option and optional context are sent to Claude Code.
5. The selected decision is preserved in the session state.

The player is never required to answer the same question again outside the game.

## 4. Corridor Generation

Immediately after the player selects a door, the game generates the Corridor.

The Corridor must remain correctly aligned with the selected Decision Room door.

The Corridor is generated in the same continuous game world as the Decision Room and Options Rooms.

While the player walks through the Corridor:

- Claude continues processing the player's decision.
- The skill continues polling for player events.
- Claude determines the next meaningful engineering decision.
- The next decision is sent to the game as soon as it is ready.

The player walking through the Corridor provides time for Claude to generate the next decision.

Do not wait for the player to finish the Corridor before asking Claude to generate the next decision.

## 5. Options Room Generation

When the next decision is available:

1. The game receives the decision.
2. The Options Room is generated.
3. The Options Room is aligned correctly with the Corridor exit.
4. The player can enter the Options Room.
5. The four options are represented by doors again.

The game must not generate the next Options Room before the corresponding decision is available.

## 6. Repeating Decision Loop

The player repeats the same gameplay cycle:

```text
Options Room
   ↓
Select door
   ↓
Context overlay
   ↓
Option + context sent to Claude
   ↓
Corridor generated
   ↓
Player walks through Corridor
   ↓
Claude generates next decision
   ↓
Options Room generated
   ↓
Player enters Options Room
```

This loop may continue for as many meaningful engineering decisions as required.

There is no fixed round limit.

The number of rounds must never determine whether the game is complete.

## 7. Final Decision

Claude must continue the loop until the engineering solution is sufficiently defined for implementation.

The final decision is still part of the same gameplay loop.

Do not introduce a separate "final interview" or "evaluation" stage.

After the final meaningful decision:

1. Claude determines that no additional decision would materially improve the implementation.
2. The final implementation document generation begins.
3. The game may display a loading state indicating that the final document is being generated.
4. The gameplay does not branch into another decision room.
5. The final result is delivered through the Trophy Room.

## 8. Trophy Room

After the final implementation document is generated, the game transitions to the Trophy Room.

The Trophy Room contains the final implementation plan.

The Trophy Room is the completion state of the gameplay.

# Responsibilities

## Claude Code

Claude Code is responsible for:

- Understanding the engineering problem.
- Understanding the user's actual use case.
- Inspecting relevant repository context when available.
- Identifying meaningful engineering decisions.
- Determining what information is required to produce a high-quality implementation plan.
- Generating the current decision.
- Generating exactly four meaningful options.
- Explaining the decision and its trade-offs.
- Providing a recommendation.
- Using the player's selected option and optional context to determine the next decision.
- Determining whether another decision is materially useful.
- Determining when the engineering solution is sufficiently defined.
- Generating the final implementation plan.

Claude Code does not control:

- Player movement.
- Map coordinates.
- Door positions.
- Room positions.
- Corridor alignment.
- Camera behavior.
- Collision boundaries.
- Visual transitions.
- Phaser gameplay state.

## Phaser

Phaser owns:

- BootScene.
- GrillingScene.
- Player movement.
- Decision Rooms.
- Doors.
- Door interactions.
- Context UI.
- Corridor generation.
- Options Room generation.
- Room alignment.
- Corridor alignment.
- Continuous world behavior.
- Camera movement.
- Loading states.
- Trophy Room.
- Visual transitions.
- Player interaction.

The Decision Room → Corridor → Options Room gameplay loop must remain inside Phaser.

## FastAPI

FastAPI owns:

- Session state.
- Decision state.
- Decision graph.
- Event queues.
- WebSocket communication.
- Skill-to-game events.
- Game-to-skill events.
- Session retrieval.
- Session synchronization.
- Final document generation state.

Engineering planning logic must not be moved into Phaser.

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

# Process Cleanup

The skill must track the processes started for the DevQuest session.

Cleanup must happen when:

- The session reaches `SESSION_COMPLETE`.
- The user explicitly ends DevQuest.
- `/devquest resume` determines that the session is no longer usable.
- Startup fails and the session cannot continue.
- The skill exits because of an unrecoverable error.

Before cleanup, stop the game and server processes started by the skill.

Do not terminate unrelated processes that were not started by the skill.

If process IDs are unavailable, clear ports `8000` and `5173` as a final cleanup step.

# Session

A DevQuest planning session uses exactly one `session_id`.

Preserve the same session ID for:

- Event polling.
- Problem submission.
- Decision generation.
- Option selection.
- Session retrieval.
- Session resume.
- Final document generation.
- Session completion.

Never create a new session because:

- The player entered a different room.
- A Corridor was generated.
- An Options Room was generated.
- Another decision round started.
- The player reached another part of the continuous world.

# Starting a Session

When `/devquest <topic>` is invoked:

1. Clear ports `8000` and `5173`.
2. Start the FastAPI server.
3. Verify the server health endpoint.
4. Start the Phaser game.
5. Verify the game at `http://localhost:5173`.
6. Create or resume exactly one DevQuest session.
7. Preserve its `session_id`.
8. Start the long-polling loop immediately.
9. Keep polling for the entire session.

If no topic is supplied, the player enters the problem through the BootScene input.

The game remains the source of the actual `PROBLEM_SUBMITTED` event.

Never require the player to repeat the problem in the terminal.

# Resume

`/devquest resume` resumes an existing session.

Retrieve available sessions:

```bash
curl -s http://localhost:8000/api/skill/sessions
```

For the selected session:

1. Preserve its `session_id`.
2. Retrieve its state when necessary.
3. Drain pending events.
4. Start long-polling with the same session ID.
5. Continue until the session completes or becomes unusable.

Never create a new session merely because the player has entered another decision round.

If the session phase is `document_generating`, preserve that phase and allow final document generation to continue.

If the session is `complete`, transition to the Trophy Room.

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
- The final implementation document is being generated.

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

If `RECONSIDER` is supported by the current implementation, preserve the original decision and create a new branch rather than overwriting it.

Ignore unknown events safely and continue polling.

Malformed events must not cause fabricated information.

# Problem Handling

When `PROBLEM_SUBMITTED` is received:

1. Understand the engineering problem.
2. Identify the user's actual use case.
3. Inspect relevant repository context when available.
4. Identify important requirements and constraints.
5. Identify the first meaningful engineering decision.
6. Generate exactly four concrete options.
7. Explain the decision.
8. Explain each option.
9. Provide a recommendation.
10. Send the decision to the game.

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

The options array must contain exactly four options in this order:

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
- Why it matters to the implementation.
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

Recommendations must use only information available in the session and repository evidence.

Do not invent:

- Constraints.
- Infrastructure.
- Team capabilities.
- Requirements.
- Performance targets.
- Operational assumptions.

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
3. Update the understanding of the implementation.
4. Reconsider the decision tree.
5. Identify the next meaningful engineering decision.
6. Generate exactly four new options.
7. Explain the decision.
8. Provide a recommendation.
9. Send the next decision to the game.

Do not repeat the previous decision unless new information genuinely requires reconsideration.

Do not generate unrelated decisions.

# Collaborative Planning

DevQuest is not a knowledge examination.

The player and Claude work together to build a practical engineering solution.

Claude should:

- Understand what the player is trying to build.
- Help identify important engineering choices.
- Explain the consequences of the choices.
- Incorporate player constraints and preferences.
- Surface assumptions that materially affect implementation.
- Use repository evidence when available.
- Help turn an ambiguous problem into a defined architecture.
- Avoid unnecessary questioning.
- Avoid asking decisions merely to increase the session length.

The player's selected choices are authoritative.

Claude's recommendations are advisory.

The goal is to produce an implementation plan that can be used to build the intended feature or system.

# Decision Sufficiency

After every selected option, determine whether another engineering decision is necessary.

Continue the Decision Room → Corridor → Options Room loop when an unresolved decision could materially change:

- Architecture.
- Data model.
- API design.
- Component boundaries.
- Service boundaries.
- Dependencies.
- Request flow.
- Event flow.
- Persistence.
- Authentication.
- Authorization.
- Error handling.
- Deployment.
- Testing.
- Performance.
- Scalability.
- Security.
- User-facing workflow.

Do not continue when the remaining questions are routine implementation details that can be resolved safely in the final implementation plan.

Do not stop because the session has become long.

Do not stop because an arbitrary round count has been reached.

Do not create a fixed round limit.

Round count is not a completion criterion.

# Corridor Behavior

The Corridor must be generated immediately after a player selects an option.

The Corridor must align with the selected Decision Room or Options Room door.

While the player moves through the Corridor:

- Continue long-polling.
- Continue processing the player's session.
- Generate the next decision when required.
- Send the decision immediately when ready.

The Corridor provides traversal time while Claude generates the next decision.

Do not wait for the player to reach the Corridor exit before generating the decision.

The Corridor is not a separate decision interface.

# Options Room Behavior

When a new decision is generated:

1. Send the decision to the game.
2. Allow Phaser to generate the Options Room.
3. Ensure the Options Room is aligned with the Corridor.
4. Allow the player to enter the Options Room.
5. Display the four new options as doors.
6. Wait for the player's door selection.
7. Continue the normal loop.

The skill must not attempt to position or manipulate the room itself.

# Continuous World

Decision Rooms, Corridors, and Options Rooms form one continuous gameplay world.

The skill must not treat each room as a new session.

Preserve:

- The same session ID.
- The same decision graph.
- The same player history.
- The same decision dependencies.
- The same selected options.
- The same player-provided context.

Room transitions must never reset the engineering planning state.

# Decision Continuity

Every new decision should build on previous decisions when relevant.

Example:

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

Before generating the final document, inspect relevant repository files again so that the final plan reflects the actual codebase.

# Challenge and Evaluation

DevQuest is not an interview and does not contain a separate challenge or evaluation phase.

The game flow is always:

```text
BootScene
→ Engineering Problem
→ Decision Room
→ Door Selection
→ Context
→ Corridor
→ Options Room
→ Door Selection
→ Context
→ Corridor
→ Options Room
→ ...
→ Final Decision
→ Final Document
→ Trophy Room
```

Do not introduce:

- A quiz stage.
- A technical test.
- A scoring stage.
- A defense stage.
- A separate challenge stage.
- A grading stage.

# Finishing

Finish the decision process when:

- Major engineering decisions are resolved.
- Important dependent decisions are resolved.
- The selected architecture is sufficiently defined.
- Important implementation boundaries are known.
- Important requirements and constraints are captured.
- The remaining questions are routine or optional.
- Another Decision Room would not materially improve the resulting implementation plan.

Do not continue merely to increase the round count.

Do not stop because a particular round number has been reached.

The objective is a sufficiently defined engineering solution.

# Final Decision

The final decision is the last meaningful engineering decision in the Decision Room → Corridor → Options Room loop.

After the player selects the final decision:

1. Preserve the selected option.
2. Preserve any additional context.
3. Determine that no additional meaningful engineering decision is required.
4. Begin final document generation.
5. Keep the player/game informed that the implementation plan is being generated.
6. Transition to the Trophy Room when the final document is complete.

The final document generation state must not introduce another gameplay room or another decision stage.

# Final Document Generation

When the solution is sufficiently defined:

1. Retrieve the full session.
2. Read the original engineering problem.
3. Read every selected decision.
4. Read all player-provided context.
5. Read decision dependencies.
6. Inspect relevant repository files.
7. Derive the architecture from the player's actual choices.
8. Identify the concrete implementation changes required.
9. Verify that no major engineering decision remains unresolved.
10. Start final document generation by calling:

```bash
curl -X POST http://localhost:8000/api/skill/finish/generating \
-H "Content-Type: application/json" \
-d '{
  "session_id": "<sid>"
}'
```

11. Generate the complete implementation plan.
12. POST the completed document to `/api/skill/finish`.
13. Allow the game to transition to the Trophy Room.

The final document must be a concrete implementation plan for the user's actual use case.

It must not merely summarize the decisions that were made.

It must not read like an interview transcript.

It must explain:

- What needs to be built.
- Why it should be built that way.
- Where it belongs.
- How the components interact.
- How data moves through the system.
- What APIs or interfaces are required.
- How failures are handled.
- How the feature should be tested.
- How the feature should be deployed.

The document must reflect the player's actual choices, not Claude's original recommendations.

# Final Document Quality Gate

Before calling `/api/skill/finish`, verify that the document answers:

- What exactly is being built?
- What problem does it solve?
- What are the goals?
- What are the non-goals?
- What architecture should be implemented?
- Which existing components must change?
- Which new components must be created?
- What data must be stored?
- What APIs or interfaces are required?
- What is the complete request/data flow?
- What are the important state transitions?
- How are errors handled?
- How are edge cases handled?
- What security considerations apply?
- What performance considerations apply?
- What tests are required?
- How is the feature deployed?
- What trade-offs were accepted?
- What risks exist?
- Are there any genuinely unresolved questions?

If a missing decision would materially change the implementation:

```text
Do not generate the final document.
Continue the Decision Room → Corridor → Options Room loop.
```

Do not invent an answer merely to make the document complete.

# Final Document Structure

Use this structure:

```markdown
# Problem Statement

Describe the original engineering problem and the user's actual use case.

# Goals and Non-Goals

Define what the implementation must achieve and what is outside scope.

# Recommended Architecture

Describe the final architecture derived from the player's selected decisions.

Explain the major components and why they fit the use case.

# Current System Analysis

Describe the relevant existing system, repository components, constraints, and integration points.

Reference concrete files, modules, services, or interfaces when repository evidence is available.

# Implementation Plan

Provide an ordered implementation plan.

For each major step explain:

- What needs to change.
- Where it belongs.
- How it should be implemented.
- Dependencies on other changes.
- Important implementation details.
- Validation required.

# Data Model

Describe new or changed entities, fields, persistence, and relationships.

# API / Interface Contract

Describe APIs, request and response shapes, events, interfaces, component contracts, and validation rules.

# Request / Data Flow

Explain the complete end-to-end flow from the user's action to the final result.

Include asynchronous behavior, events, and important state transitions.

# Component and Module Changes

Map the implementation to actual components, services, files, or modules.

Clearly distinguish:

- Existing components to modify.
- New components to create.
- Components that do not need changes.

# Edge Cases and Failure Handling

Describe important failure cases, invalid input, unavailable dependencies, partial failures, race conditions, retries, and recovery behavior.

# Security Considerations

Describe relevant authentication, authorization, validation, secrets, data protection, trust boundaries, and abuse considerations.

Only include items relevant to the actual system.

# Performance and Scalability

Describe relevant latency, throughput, caching, concurrency, resource usage, and scaling considerations.

Only include items relevant to the actual use case.

# Testing and Validation

Define:

- Unit tests.
- Integration tests.
- End-to-end tests.
- Edge-case tests.
- Failure-path tests.
- Performance tests when relevant.
- Manual validation steps when useful.

# Deployment and Rollout

Describe required configuration, migrations, deployment changes, feature flags, rollout order, compatibility concerns, and rollback strategy when relevant.

# Usage Flow

Describe how the user will use the completed feature from start to finish.

# Trade-offs Accepted

Describe the important trade-offs introduced by the selected architecture.

# Risks

Describe meaningful technical risks and how they should be validated or mitigated.

# Open Questions

Only include genuinely unresolved engineering questions.

None.
```

The implementation plan must be concrete enough for an engineer to start implementation without reconstructing the session.

Do not use vague statements such as:

```text
Implement the backend.
Update the frontend.
Add the API.
Handle errors.
```

Instead specify actual files, components, functions, data structures, interfaces, and behavior.

When repository evidence is available, reference concrete paths such as:

```text
apps/server/app/services/session_service.py
apps/server/app/engine/engine.py
apps/game/src/scenes/GrillingScene.ts
apps/game/src/components/GameUI.tsx
```

# Finish Request

After the final implementation document has been generated and quality-checked, send:

```bash
curl -X POST http://localhost:8000/api/skill/finish \
-H "Content-Type: application/json" \
-d '{
  "session_id": "<sid>",
  "summary": "Final engineering direction summary",
  "doc_content": "<full implementation plan markdown document>"
}'
```

The summary must be a concise description of the final engineering direction.

The `doc_content` must contain the complete implementation plan.

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
- Current phase.
- Final document generation state.

Never reconstruct important state from memory when the server can provide it.

# Session IDs and Node IDs

Preserve the same session ID for the entire planning session.

Preserve every decision `nodeId`.

Never create a new session because the player:

- Entered a Corridor.
- Entered an Options Room.
- Made another decision.
- Returned to a previous room.
- Reached the final decision.

Never overwrite an existing decision node.

# Terminal Output

Keep terminal output concise.

Use:

```text
DevQuest: http://localhost:5173
```

Do not print the decision tree or planning instructions in the terminal.

The game is the primary interface.

# Player Inactivity

The game is the primary interface.

Do not repeatedly send terminal messages while the player is inactive.

Do not make decisions for the player.

# Final Principles

1. DevQuest is a collaborative engineering planning system, not a knowledge test.
2. The game flow must remain BootScene → Decision Room → Corridor → Options Room → Corridor → Options Room → ... → Trophy Room.
3. BootScene is where the player enters the engineering problem.
4. The first GrillingScene contains the initial Decision Room.
5. Every decision contains exactly four doors: A, B, C, and D.
6. The player selects a door by walking to it and pressing `E`.
7. A context overlay appears after door selection.
8. The selected option and optional context are sent to Claude.
9. A Corridor is generated immediately after selection.
10. The Corridor must align with the selected door.
11. Claude generates the next decision while the player walks through the Corridor.
12. An Options Room is generated when the next decision is ready.
13. The Options Room must align with the Corridor.
14. The player repeats the same decision loop until the engineering solution is sufficiently defined.
15. There is no fixed maximum number of decision rounds.
16. Round count is not a completion criterion.
17. Claude must not pad the session with unnecessary decisions.
18. Claude must continue the loop when an unresolved decision would materially affect the implementation.
19. Claude must use the player's selected choices as the source of truth.
20. Claude's recommendations are advisory.
21. Phaser owns all gameplay, room generation, movement, alignment, and visual transitions.
22. FastAPI owns session state and communication.
23. The final document must be an implementation-ready engineering plan, not a session summary.
24. The final document must be specific to the user's actual use case.
25. The final document must use repository evidence when repository access is available.
26. Final document generation must happen after the final meaningful decision.
27. Final document generation must not introduce a new gameplay stage.
28. Trophy Room is the final gameplay destination.
29. Preserve the same session ID throughout the complete game.
30. Preserve all decision history and player context.
31. Maintain exactly one active long-polling loop per session.
32. Never require the player to repeat an in-game action in the terminal.
33. Do not invent repository information or constraints.
34. Clean up processes started by DevQuest when the session ends.