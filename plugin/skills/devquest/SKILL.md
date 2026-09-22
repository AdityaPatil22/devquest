---
name: devquest
description: "Run an engineering decision grilling interview inside a 2D Phaser game. The player enters a problem statement at the Gate, then navigates Decision Rooms where doors represent options. The skill generates questions, challenges reasoning, and produces a final decision document as the player's trophy. Use when the user says 'devquest', 'grill me', invokes /devquest with a topic, or says '/devquest resume'."
---

# devquest

The game is a 2D world the player walks through. Four areas in sequence:

1. **Common Room** — menu screen. Start new session, resume, settings.
2. **Gate** — the player types what they want to be grilled on.
3. **Decision Room** — a generic room with N doors, one per option the skill generated.
   The player walks to a door, optionally adds context, and enters. The room resets with
   the next question. This loops until the skill says the tree is walked.
4. **Trophy Room** — the finished engineering document, displayed as a trophy.

The skill owns the grilling logic. Phaser owns the experience. The game never generates
decisions — it receives them from the skill via the FastAPI broker and renders doors.

Communication: skill polls `GET /api/skill/events/pending/long-poll` for player actions,
then POSTs questions/challenges/evaluations back. The server pushes them to the game over
WebSocket. The game sends player actions (problem statement, door selection, context,
challenge response) over WebSocket to the server, which enqueues them for the skill.

## Start (`/devquest <topic>`, `$devquest <topic>`, or "devquest: <topic>")

1. From the project directory start the FastAPI server (if not already running):
   ```bash
   cd <project_root>/apps/server
   uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 &
   ```
   Confirm: `curl -s http://localhost:8000/api/health`

2. Start the game dev server (if not already running):
   ```bash
   cd <project_root>/apps/game && npm run dev &
   ```

3. If a `<topic>` was provided, pre-fill it: POST to `/api/skill/prefill` so the Gate
   auto-populates. Otherwise the player types it in-game.

4. Print ONE line: the URL (`http://localhost:5173`), and tell the user to open the game.
   End the turn.

5. Enter the event loop.

## Resume (`/devquest resume`)

1. Confirm the server is running. If not, start it.
2. `curl -s http://localhost:8000/api/skill/sessions` — list active sessions.
   One session: take it. Several: list them and ask. None: say so and stop.
3. Drain pending events. Process each following "Handling an event".
4. Enter the event loop.

## The event loop

```bash
curl -s "http://localhost:8000/api/skill/events/pending/long-poll?session_id=<sid>&timeout=30"
```

If `{"event": null}`, re-issue. When an event arrives, handle it immediately following
"Handling an event", then loop.

**Every event is user input.** The player did something in the game on purpose. Act on it
immediately. Never wait for terminal confirmation. Never merely summarize it.

## Handling an event

### PROBLEM_SUBMITTED
The player typed their problem statement at the Gate and walked through.

`{ "type": "PROBLEM_SUBMITTED", "sessionId": "...", "problem": "Should I rewrite the auth service in Go?" }`

1. Read the problem statement.
2. If `--repo` was provided, scan the codebase for context relevant to this problem.
3. Generate the **first question** following Interview method. This is the first fork in
   the decision tree.
4. POST the question:
   ```bash
   curl -X POST http://localhost:8000/api/skill/decisions \
     -H "Content-Type: application/json" \
     -d '{
       "session_id": "<sid>",
       "question": "Which language should the rewrite target?",
       "options": [
         {"id": "A", "label": "Go"},
         {"id": "B", "label": "Rust"},
         {"id": "C", "label": "Stay with Node.js"},
         {"id": "D", "label": "Python"}
       ],
       "recommendation": {"option": "C", "why": "The current service works. Rewrites carry risk."},
       "round": 1
     }'
   ```
5. The game renders a Decision Room with 4 doors labeled A–D.
6. Print one terminal line: the problem and the first question. Continue polling.

### OPTION_SELECTED
The player walked to a door and selected an option, optionally with additional context.

`{ "type": "OPTION_SELECTED", "sessionId": "...", "nodeId": "...", "optionId": "A", "context": "I was also thinking about Zig but it felt too early" }`

1. Read the selected option and any additional context.
2. **Challenge the choice.** This is the core of the skill. Follow Challenge guidelines:
   - POST a challenge:
     ```bash
     curl -X POST http://localhost:8000/api/skill/challenge \
       -H "Content-Type: application/json" \
       -d '{
         "session_id": "<sid>",
         "node_id": "<nid>",
         "question": "Go is fast, but your team has zero Go experience. How do you plan to handle the 3-6 month learning curve during a rewrite?"
       }'
     ```
3. The game shows the challenge with a text input for the player to respond.
4. Print one terminal line. Continue polling.

### CHALLENGE_RESPONSE
The player defended their choice.

`{ "type": "CHALLENGE_RESPONSE", "sessionId": "...", "nodeId": "...", "response": "We'll pair with a Go consultant for the first month..." }`

1. Evaluate the defense. Grade honestly.
2. POST the evaluation:
   ```bash
   curl -X POST http://localhost:8000/api/skill/evaluation \
     -H "Content-Type: application/json" \
     -d '{
       "session_id": "<sid>",
       "node_id": "<nid>",
       "feedback": "Hiring a consultant mitigates the initial risk, but knowledge transfer is the hard part.",
       "consequence": "Budget for 2 months of pairing, not 1. The team needs to own the code by month 3."
     }'
   ```
3. **Immediately generate the next question.** The evaluation and the next question arrive
   together. The game shows the evaluation briefly, then transitions to the next Decision
   Room with new doors.
   ```bash
   curl -X POST http://localhost:8000/api/skill/decisions \
     -H "Content-Type: application/json" \
     -d '{
       "session_id": "<sid>",
       "question": "Given you chose Go: which HTTP framework?",
       "options": [
         {"id": "A", "label": "Standard library net/http"},
         {"id": "B", "label": "Gin"},
         {"id": "C", "label": "Echo"}
       ],
       "recommendation": {"option": "A", "why": "Standard library is stable and needs no dependency management."},
       "round": 2,
       "depends_on": "<previous node_id>"
     }'
   ```
4. If the decision tree is fully walked (no more meaningful questions to ask), send a
   `finish` signal instead of a next question:
   ```bash
   curl -X POST http://localhost:8000/api/skill/finish \
     -H "Content-Type: application/json" \
     -d '{
       "session_id": "<sid>",
       "summary": "Rewrite auth service in Go with net/http, PostgreSQL, JWT auth...",
       "doc_content": "<full markdown document>"
     }'
   ```
   The game transitions to the Trophy Room.
5. Print one terminal line. Continue polling.

### RECONSIDER
The player wants to revisit a previous decision.

1. GET the session to see the previous choice and reasoning.
2. Reframe: "You chose X because [reason]. Given [consequence], reconsider."
3. POST a new decision with the same or updated options.
4. Continue polling.

## Interview method

Walk the decision tree relentlessly. Each answer opens the next branch:

```
Problem: "Should I rewrite the auth service in Go?"
  │
  ├── Q1: Which language? → Go
  │     ├── Q2: Which HTTP framework? → net/http
  │     │     ├── Q3: How do you handle middleware? → ...
  │     │     └── ...
  │     ├── Q4: Database driver? → pgx
  │     └── Q5: Error handling strategy? → ...
  │
  ├── Q6: How do you migrate existing users? → ...
  └── Q7: Rollback plan? → ...
```

Rules:
- **Each answer determines the next question.** If they chose Go, ask Go-specific questions.
  If they chose "Stay with Node.js", the next question is about improving the existing
  service, not about Go frameworks.
- **Every question must have** 2–4 concrete options, each a real choice an engineer would
  consider. Never vague ("A relational database"). Always specific ("PostgreSQL").
- **Include a recommendation** with every question: the option you'd pick, and a one-paragraph
  why. The game can display this as a hint. The player is free to disagree.
- **Durable vs routine**: language choice, database engine, auth model — these are durable
  (hard to reverse). Challenge them harder. Log format, folder structure — routine. One
  question, move on.
- **Repository context**: when available, reference actual files. Don't ask "which database?"
  if `schema.prisma` already says PostgreSQL. Ask "why Prisma over raw SQL for this use
  case?"
- **Cross-question dependencies**: track `depends_on`. If they chose JWT in Q3, Q7 about
  session management should reference JWT's stateless nature.
- **Stop when done.** When the tree is fully walked — every branch resolved — finish. Four
  hard questions are better than twelve soft ones. Don't pad.

## Challenge guidelines

Every decision gets challenged. Every one. Including correct ones.

- **Shallow reasoning gets pushed back:**
  - "It's popular" → "Popular doesn't mean correct for your constraints. What specific
    requirement does X satisfy?"
  - "I've always used it" → "Familiarity is valid, but what happens when [edge case]?"
  - "It's the best" → "Best by what metric? Latency? Maintainability? Cost?"
- **Strong reasoning still gets tested from the other side:**
  - "Solid argument. But the strongest case against X is [counter]. How do you address it?"
- **Contradictions get called out immediately:**
  - "You chose stateless JWT in Q3, but now you want server-side session revocation. Those
    conflict. How do you reconcile?"
- **2 sentences max for challenges.** This is a game. Walls of text kill the flow.
- **2 sentences feedback + 2 sentences consequence for evaluations.** Crisp.

## Finish

When the decision tree is fully walked, or the player says "finish":

1. GET the full session graph:
   ```bash
   curl -s http://localhost:8000/api/skill/sessions/<sid>
   ```

2. Generate the decision document. Structure:
   - **Problem Statement**: what the player entered at the Gate.
   - **Summary**: one paragraph of the key decisions and their relationships.
   - **Decision Chain**: for each question in order:
     - Question, chosen option, reasoning, challenge, defense, evaluation, consequence.
     - Mark reconsidered decisions — show both old and new branches.
   - **Architecture Outcome**: what the final system looks like given all decisions.
   - **Trade-offs Accepted**: what they knowingly gave up.
   - **Risks**: weak defenses, contradictions, unresolved consequences.
   - **Open Questions**: things that remain undecided.

3. POST the finished document:
   ```bash
   curl -X POST http://localhost:8000/api/skill/finish \
     -H "Content-Type: application/json" \
     -d '{
       "session_id": "<sid>",
       "summary": "one-line summary",
       "doc_content": "<full markdown>",
       "decisions_count": 7,
       "reconsidered_count": 1
     }'
   ```

4. Write the doc to `docs/<topic-slug>-decisions.md` in the project root.

5. The game transitions to the Trophy Room showing the document summary and a
   "Download Doc" option.

6. Print the doc path. End.

## The door mechanic — how Phaser renders options

The skill sends options as an ordered list. The game renders exactly that many doors:

```
Skill sends:
  options: [{id: "A", label: "Redis"}, {id: "B", label: "PostgreSQL"}, {id: "C", label: "CDN"}]

Game renders:
  ┌──────────────────────────────────┐
  │         Decision Room            │
  │                                  │
  │            🧑 Player             │
  │                                  │
  │    🚪 A      🚪 B      🚪 C      │
  │   Redis   PostgreSQL    CDN      │
  └──────────────────────────────────┘
```

When the player approaches a door, the game shows:
- The option label
- The recommendation (if this door matches the recommended option)
- An optional text input: "Add context before entering?"
- An [Enter] button

The player walks through the door. The room transitions. New doors appear.

The game never needs to know what Redis is. It just renders doors with labels.

## Terminal input

During a session:
- "finish" → trigger Finish.
- "status" → print decision count, current question, rounds completed.
- Anything else → "Use the game. Type 'finish' to end the session."

## Error handling

- Server not responding → start it. If it fails, print error and stop.
- Game not running → tell user to open `http://localhost:5173`.
- Malformed event → skip, log warning, continue.
- Player idle 5+ minutes → one terminal nudge. Do not spam.
- Skill generates no more questions but hasn't called finish → auto-finish.
