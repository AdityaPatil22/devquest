---
name: devquest
description: "Launch the DevQuest Interactive Engineering Decision Simulator. Use when the user wants to review engineering decisions, explore architecture choices in a game, or says 'devquest', 'grill me', 'decision review', or 'engineering review'."
---

# DevQuest Skill

Launch and manage the DevQuest Interactive Engineering Decision Simulator — a 2D game where developers explore a software office and defend their engineering decisions to an AI reviewer.

## How It Works

1. The skill starts a local FastAPI server that hosts the game
2. The game opens in the browser at `http://localhost:8000`
3. The player moves around a 2D office and interacts with areas (API Lab, Database Lab, Security, Deployment)
4. When the player enters an area, the skill receives a notification and generates engineering questions
5. The player answers in-game, and the skill challenges their reasoning
6. Decisions are recorded in a visual decision graph

## Activation

When the user asks to start a DevQuest session:

### Step 1: Start the server

```bash
cd <project_root>
devquest start --repo . --skill-mode --no-browser
```

Or if not installed:

```bash
cd <project_root>/apps/server
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Tell the user: **"DevQuest is running. Open http://localhost:8000 in your browser."**

### Step 2: Enter the grilling loop

Continuously poll for player events and respond:

```bash
# Poll for player events
curl -s http://localhost:8000/api/skill/events/pending/long-poll?timeout=30
```

### Step 3: Handle events

When you receive an event:

#### ENTER_AREA
The player entered a room. Generate a relevant engineering decision question based on:
- The area (api-lab, database-lab, security-lab, deployment)
- The repository context (if --repo was provided)
- Previous decisions in this session

Send the question:
```bash
curl -X POST http://localhost:8000/api/skill/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<session_id>",
    "area_id": "<area_id>",
    "question": "Your engineering question here",
    "options": [
      {"id": "option1", "label": "Option 1"},
      {"id": "option2", "label": "Option 2"},
      {"id": "option3", "label": "Option 3"}
    ]
  }'
```

#### REASONING_SUBMITTED
The player chose an option and explained why. Read their reasoning, then challenge it:

```bash
curl -X POST http://localhost:8000/api/skill/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<session_id>",
    "node_id": "<node_id>",
    "question": "Your follow-up challenge here"
  }'
```

#### CHALLENGE_RESPONSE
The player responded to your challenge. Evaluate their complete decision:

```bash
curl -X POST http://localhost:8000/api/skill/evaluation \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "<session_id>",
    "node_id": "<node_id>",
    "feedback": "Your evaluation of their decision",
    "consequence": "What this means for their architecture"
  }'
```

#### RECONSIDER
The player wants to reconsider a previous decision. Generate a new question for the same area, acknowledging their previous choice.

### Step 4: Continue the loop

After handling each event, go back to polling. Continue until the user says they're done or all areas are completed.

## Question Generation Guidelines

- Make questions specific to the repository when context is available
- Offer 3-4 realistic options per question
- Challenge weak reasoning — don't accept "it's popular" as sufficient
- Connect consequences to real architectural impacts
- Keep responses under 3 sentences — this is a game, not a lecture
- Reference previous decisions when relevant ("Given you chose PostgreSQL...")

## Example Questions by Area

### API Lab
- "How should we handle API versioning?"
- "What authentication mechanism should we use?"
- "Should we use REST, GraphQL, or gRPC?"

### Database Lab
- "Which database should we use for the user service?"
- "How should we handle data migrations?"
- "What caching strategy should we implement?"

### Security
- "How should we store user credentials?"
- "What authorization model should we use?"
- "How do we handle API rate limiting?"

### Deployment
- "What container orchestration should we use?"
- "How should we handle CI/CD?"
- "What's our rollback strategy?"
