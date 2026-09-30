\---

name: devquest

description: "Run an engineering decision interview inside the DevQuest 2D Phaser game. The player enters an engineering problem, walks through a sequence of Decision Rooms and Corridors, chooses between four technical options at each step, and receives a final decision document in the Trophy Room. Use when the user says 'devquest', 'grill me', invokes /devquest with a topic, or says '/devquest resume'."

disable-model-invocation: true

\------------------------------

**# DevQuest**

DevQuest is an interactive engineering decision simulator.

The player:

1\. Starts in the Common Room.

2\. Walks to the elevator.

3\. Presses \`E\`.

4\. Enters the engineering problem they want to be grilled on.

5\. Enters the Grilling Room.

6\. Makes engineering decisions by walking through doors.

7\. Optionally provides additional context after selecting a door.

8\. Continues through Corridors and Options Rooms while Claude generates the next decision.

9\. Repeats the decision loop until the meaningful engineering decisions are complete.

10\. Enters the Trophy Room and receives the final decision document.

The game is the user interface.

Claude Code is the engineering interviewer and decision-tree engine.

FastAPI is the communication broker between Claude Code and the game.

The game must never invent engineering decisions.

**---**

**# Game Flow**

The authoritative gameplay flow is:

\`\`\`text

Common Room

    │

    ▼

Walk to Elevator

    │

    ▼

Press E

    │

    ▼

"What do you want to be grilled on?"

    │

    ▼

Player enters engineering problem

    │

    ▼

Grilling Room

    │

    ▼

Initial Decision Room

    │

    ▼

Claude provides exactly 4 options:

A / B / C / D

    │

    ▼

Player walks to a door

    │

    ▼

Press E

    │

    ▼

"Do you want to provide more context?"

    │

    ▼

Player optionally enters context

    │

    ▼

OPTION_SELECTED

    │

    ├─────────────────────────────┐

    │                             │

    ▼                             │

Claude generates next decision │

    │                             │

    │ Game generates Corridor     │

    │ Player walks through it     │

    │                             │

    ▼                             │

Next decision generated │

    │                             │

    ▼                             │

Game generates Options Room │

    │                             │

    ▼                             │

4 new doors A / B / C / D │

    │                             │

    ▼                             │

Player selects another option ────┘

    │

    ▼

Repeat until no meaningful decisions remain

    │

    ▼

Final decision

    │

    ▼

Trophy Room

\`\`\`

The skill must support this flow directly.

Do not introduce additional gameplay stages that are not part of this flow.

**---**

**# Responsibilities**

**## Claude Code owns**

Claude Code is responsible for:

\* Understanding the player's engineering problem

\* Inspecting relevant repository context

\* Identifying important constraints

\* Creating the decision tree

\* Generating the current decision

\* Generating exactly four options

\* Explaining each option

\* Explaining why the decision matters

\* Providing the current recommendation

\* Explaining what information could change the recommendation

\* Using the player's selected option and additional context to determine the next decision

\* Deciding when the meaningful decision tree is complete

\* Generating the final decision document

**## Phaser owns**

Phaser is responsible for:

\* Common Room

\* Elevator interaction

\* Problem input overlay

\* Grilling Room

\* Decision Rooms

\* Doors

\* Player movement

\* Corridor generation

\* Options Room generation

\* Room alignment

\* Camera movement

\* Context overlay

\* Visual loading states

\* Trophy Room

\* All visual transitions

Claude Code must never attempt to control map coordinates, player movement, door placement, corridor placement, or room alignment.

**## FastAPI owns**

FastAPI is responsible for:

\* Session state

\* Event queues

\* WebSocket communication

\* Skill-to-game messages

\* Game-to-skill events

\* Session retrieval

Never move engineering decision logic into Phaser.

**---**

**# Communication Model**

\`\`\`text

Claude Code

    │

    │ HTTP

    ▼

FastAPI Server

    │

    │ WebSocket

    ▼

Phaser Game

\`\`\`

Claude Code communicates with FastAPI over HTTP.

The game communicates with FastAPI over WebSocket.

The server acts as the broker.

The player generates events in the game.

The skill reads those events from the server.

**---**

**# API Endpoints**

**## Player events**

Poll:

\`\`\`text

GET /api/skill/events/pending/long-poll

\`\`\`

Use:

\`\`\`bash

curl -s "http\://localhost:8000/api/skill/events/pending/long-poll?session_id=\<sid>&timeout=30"

\`\`\`

**## Create a decision**

\`\`\`text

POST /api/skill/decisions

\`\`\`

**## Finish a session**

\`\`\`text

POST /api/skill/finish

\`\`\`

The current DevQuest game does not require separate skill endpoints for challenge or evaluation in the primary gameplay loop.

Do not invent or call unnecessary endpoints.

**---**

**# Runtime**

DevQuest runs as:

\`\`\`text

apps/server

apps/game

\`\`\`

Server:

\`\`\`text

http\://127.0.0.1:8000

\`\`\`

Game:

\`\`\`text

http\://localhost:5173

\`\`\`

Before starting either service, check whether it is already running.

Do not start duplicate processes when a healthy process already exists.

**---**

**# Server Startup**

Start the server from:

\`\`\`text

apps/server

\`\`\`

using:

\`\`\`bash

uv run uvicorn app.main\\\:app --host 127.0.0.1 --port 8000

\`\`\`

Check health:

\`\`\`bash

curl -s http\://localhost:8000/api/health

\`\`\`

If the server is already healthy, do not start another instance.

**---**

**# Game Startup**

Start the game from:

\`\`\`text

apps/game

\`\`\`

using:

\`\`\`bash

npm run dev

\`\`\`

The game should be available at:

\`\`\`text

http\://localhost:5173

\`\`\`

If the game is already running, do not start another instance.

**---**

**# Invocation**

The skill can be invoked with:

\`\`\`text

/devquest \<topic>

\`\`\`

or:

\`\`\`text

$devquest \<topic>

\`\`\`

or:

\`\`\`text

devquest: \<topic>

\`\`\`

or:

\`\`\`text

devquest

\`\`\`

When no topic is supplied, the player enters the problem through the game.

**---**

**# Starting a Session**

When \`/devquest \<topic>\` is invoked:

1\. Ensure the FastAPI server is running.

2\. Ensure the game is running.

3\. Preserve the supplied topic as the intended engineering problem.

4\. Open or direct the player to:

\`\`\`text
http\://localhost:5173
\`\`\`

5\. Start or resume exactly one DevQuest session and preserve its `session_id` for the entire interview.

6\. As soon as a usable `session_id` is available, immediately start the event loop using that session ID.

7\. Keep the event loop active for the entire DevQuest session. Do not wait for a conversational message from the player before polling.

8\. When the player submits a problem through the game, receive the `PROBLEM_SUBMITTED` event through the active long-poll request and process it immediately.

9\. Use the supplied topic to guide the initial decision when the game submits the problem. The game remains the source of the actual `PROBLEM_SUBMITTED` event.

Do not create an API endpoint only for topic prefill.

The current game can submit the problem through the normal game flow.

The long-polling loop must already be active once the session ID is available and before the player is expected to submit the problem.

Never require the player to tell Claude Code that they submitted the problem in the game.
**# Terminal Response**

Keep terminal output concise.

Use:

\`\`\`text

DevQuest: http\://localhost:5173

\`\`\`

The game is the primary interface.

Do not print the entire decision tree or interview instructions in the terminal.

**---**

**# Resume**

\`/devquest resume\` resumes an existing session.

Use:

\`\`\`bash
curl -s http\://localhost:8000/api/skill/sessions
\`\`\`

When a usable session exists:

1\. Preserve its session ID.

2\. Inspect its current state if necessary.

3\. Drain pending events.

4\. Immediately start the long-polling loop with that same session ID.

5\. Keep polling continuously until the session is complete.

Do not create a new session simply because another decision round begins.

Do not wait for the player to send a conversational message before resuming event polling.
**# Session State**

Inspect a session with:

\`\`\`bash

curl -s http\://localhost:8000/api/skill/sessions/\<sid>

\`\`\`

Use the session data to understand:

\* Original engineering problem

\* Previous decisions

\* Selected options

\* Additional context

\* Decision dependencies

\* Current decision

\* Overall progress

Never reconstruct important session state from memory when the server can provide it.

**---**

**# Event Loop**

The event loop is a persistent long-polling loop that remains active for the entire DevQuest interview.

Start polling immediately after the session ID is known.

Always use the session-specific endpoint:

\`\`\`bash
curl -s "http\://localhost:8000/api/skill/events/pending/long-poll?session_id=\<sid>&timeout=30"
\`\`\`

Never rely on the conversation with the player as the signal that an event has occurred.

The polling flow is:

\`\`\`text
Start / resume session
↓
Obtain session ID
↓
Start long polling immediately
↓
Wait for player event
↓
Event received
↓
Process event immediately
↓
Perform the required action
↓
Return to long polling
↓
Repeat until session is complete
\`\`\`

When:

\`\`\`json
{
"event": null
}
\`\`\`

the long-poll request timed out without an event.

Treat this as a normal timeout, not as session completion.

Immediately issue the same long-poll request again:

\`\`\`bash
curl -s "http\://localhost:8000/api/skill/events/pending/long-poll?session_id=\<sid>&timeout=30"
\`\`\`

Do not stop polling after a timeout.

Do not stop polling after \`PROBLEM_SUBMITTED\`.

Do not stop polling after \`OPTION_SELECTED\`.

Do not stop polling after \`RECONSIDER\`.

After processing every event, return to the long-poll request unless the session has been completed or the session ID is no longer usable.

The primary player events are:

\`\`\`text
PROBLEM_SUBMITTED
OPTION_SELECTED
RECONSIDER
\`\`\`

\`CHALLENGE_RESPONSE\` and evaluation are not part of the primary DevQuest gameplay loop. Do not introduce them into the interview unless the current game implementation explicitly requires them.

The implementation may expose additional events.

Ignore unknown events safely.

Do not terminate the session just because an unknown event appears.

**## Polling Requirements**

The skill MUST:

1\. Know the active \`session_id\` before polling.

2\. Use \`session_id=\<sid>\` on every long-poll request.

3\. Keep exactly one active polling loop for the current DevQuest session.

4\. Process an arriving event immediately.

5\. Resume polling after processing the event.

6\. Re-poll immediately when the server returns \`event: null\`.

7\. Keep polling while the player is walking through the Corridor.

8\. Keep polling while the player is interacting with the Options Room.

9\. Never require the player to tell Claude Code that an in-game action has happened.

10\. Stop polling only when the session is complete or the session can no longer be used.

**## Initial Problem Synchronization**

The player may submit the engineering problem before the skill has finished any conversational response.

The skill must therefore be listening for:

\`\`\`text
PROBLEM_SUBMITTED
\`\`\`

as soon as the game is available and the session ID is established.

If the player submits the problem while the skill is already long-polling, the event must be consumed by that poll request.

If the player submits the problem before the next poll request begins, the event remains pending in the server queue and must be consumed by the next poll request.

Do not ask the player to repeat the problem in the terminal unless the server event is malformed or the session cannot be recovered.
**# Handling PROBLEM_SUBMITTED**

The player has entered the engineering problem.

Example:

\`\`\`json

{

"type": "PROBLEM_SUBMITTED",

"sessionId": "...",

"problem": "Should we move our Node.js API to Go?"

}

\`\`\`

Follow this process:

1\. Understand the problem.

2\. Identify the actual engineering decision.

3\. Inspect the repository when repository context is available.

4\. Identify the constraints that matter.

5\. Identify the first meaningful decision.

6\. Generate exactly four concrete options.

7\. Explain the decision.

8\. Explain every option.

9\. Provide a recommendation.

10\. Send the decision to the game.

The first decision becomes the first Decision Room.

**---**

**# Decision Output Contract**

Every decision sent to the game MUST follow this contract.

A decision MUST contain:

\`\`\`text

question

description

options

recommendation

round

\`\`\`

The \`options\` array MUST contain exactly four options.

The four IDs MUST be:

\`\`\`text

A

B

C

D

\`\`\`

in that exact order.

Never send:

\* 1 option

\* 2 options

\* 3 options

\* 5 or more options

\* placeholder options

\* duplicate options

\* "Other"

\* "None"

\* "Something else"

\* "It depends"

The game expects four doors.

\`\`\`text

A → Door A

B → Door B

C → Door C

D → Door D

\`\`\`

**---**

**# Decision Description**

Every decision MUST contain a \`description\`.

The decision description should explain:

\* What is being decided

\* Why it matters

\* Which constraints matter

\* What trade-offs the player should consider

\* What information is important before choosing

Keep it concise enough to read during gameplay.

A good description looks like:

\`\`\`text

We need to decide how the service should authenticate users.

The important factors are security, scalability, operational complexity,

credential revocation, and the infrastructure we already operate.

\`\`\`

Do not write a long essay.

**---**

**# Option Description**

Every option MUST contain:

\`\`\`json

{

"id": "A",

"label": "Short option name",

"description": "Concise explanation of what this option means, why it may fit, and its main trade-off."

}

\`\`\`

The description must help the player understand the choice before entering the door.

For example:

\`\`\`json

{

"id": "A",

"label": "PostgreSQL",

"description": "Relational storage with strong transactional guarantees and familiar querying, but requires managing a database service."

}

\`\`\`

The option label should be short.

The option description may explain:

\* What the option is

\* Why it may be useful

\* Important trade-offs

\* Important constraints

Do not put long paragraphs into option descriptions.

**---**

**# Recommendation**

Every decision MUST contain a recommendation.

The recommendation MUST contain:

\`\`\`text

option

why

what_to_know

\`\`\`

Example:

\`\`\`json

{

"option": "A",

"why": "PostgreSQL fits the existing application model and provides the transactional guarantees required by the workload.",

"what_to_know": "This assumes relational access patterns remain dominant. If the workload becomes primarily document-oriented, another storage model may become more appropriate."

}

\`\`\`

The recommendation is guidance.

It is not a correct answer that the player must select.

The player can choose any option.

Do not make the game punish the player for disagreeing with the recommendation.

**---**

**# Example Decision Request**

Example request:

\`\`\`bash

curl -X POST http\://localhost:8000/api/skill/decisions \\

-H "Content-Type: application/json" \\

-d '{

    "session_id": "\<sid>",

    "question": "Which authentication approach should the service use?",

    "description": "We need to choose an authentication model. The main considerations are security, scalability, credential revocation, operational complexity, and how well the approach fits the current infrastructure.",

    "options": [

      {

        "id": "A",

        "label": "JWT authentication",

        "description": "Stateless authentication that scales well, but token storage and revocation require careful handling."

      },

      {

        "id": "B",

        "label": "Server-side sessions",

        "description": "Stores authentication state on the server, making revocation simple but requiring shared session storage for multiple instances."

      },

      {

        "id": "C",

        "label": "OAuth / OIDC",

        "description": "Delegates authentication to an identity provider, reducing custom authentication logic but introducing an external dependency."

      },

      {

        "id": "D",

        "label": "Gateway authentication",

        "description": "Authenticates requests before they reach the application, centralizing security but adding infrastructure complexity."

      }

    ],

    "recommendation": {

      "option": "A",

      "why": "JWT keeps the service stateless and fits the current horizontally scalable architecture.",

      "what_to_know": "This depends on having a secure token lifecycle and acceptable revocation behavior."

    },

    "round": 1

}'

\`\`\`

**---**

**# Player Decision Flow**

When the game sends:

\`\`\`json

{

"type": "OPTION_SELECTED",

"sessionId": "...",

"nodeId": "...",

"optionId": "A",

"context": "We already use Redis and want to avoid another persistent dependency."

}

\`\`\`

The selected option and context become inputs to the next decision.

The skill should:

1\. Identify the selected option.

2\. Read the additional context.

3\. Reconsider the decision tree using that information.

4\. Identify the next meaningful engineering decision.

5\. Generate exactly four new options.

6\. Explain the new decision.

7\. Explain the new options.

8\. Provide a recommendation.

9\. Send the next decision to the game.

Do not ask unnecessary questions.

Do not repeat the same decision.

Do not generate unrelated decisions.

**---**

**# Corridor Behavior**

The corridor exists to hide the time required for Claude to generate the next decision.

The game is responsible for generating the Corridor immediately after the player selects a door.

The skill does not need to know how the Corridor is rendered.

While the player walks through the Corridor, Claude should generate the next decision.

When the next decision is ready, send it immediately.

Do not delay the response because the player is still walking.

The game decides when to reveal the next Options Room.

**---**

**# Decision-to-Decision Continuity**

Every new decision must be informed by previous decisions.

A decision should feel like the next step in the same engineering conversation.

Example:

\`\`\`text

Q1:

Which database?

Player chooses PostgreSQL.

Q2:

Given PostgreSQL, how should the application access it?

A Prisma

B SQLAlchemy

C Raw SQL

D Repository abstraction

\`\`\`

The next question should acknowledge the earlier choice when relevant.

Do not ask the player to repeat information already present in the session.

**---**

**# Decision Dependencies**

When a new decision directly depends on a previous decision, include:

\`\`\`json

"depends_on": "\<previous-node-id>"

\`\`\`

Example:

\`\`\`json

{

"question": "Given that you selected JWT authentication, how should token expiration be handled?",

"depends_on": "\<previous-node-id>"

}

\`\`\`

Use dependencies to preserve the decision tree.

Do not create dependencies when they are not meaningful.

**---**

**# Four Meaningful Options**

Exactly four does not mean four arbitrary choices.

The four options should be:

\* Technically meaningful

\* Distinct

\* Realistic

\* Relevant to the current constraints

\* Relevant to the previous decisions

Avoid four choices that differ only in wording.

Bad:

\`\`\`text

A Use Redis

B Use Redis with caching

C Use Redis for performance

D Use Redis as a cache

\`\`\`

Good:

\`\`\`text

A Redis

B PostgreSQL

C In-memory cache

D Managed cache service

\`\`\`

**---**

**# Option Diversity**

When generating four options, consider different engineering strategies.

Possible dimensions include:

\* Simpler vs more configurable

\* Managed vs self-hosted

\* Existing technology vs new technology

\* Stateful vs stateless

\* Synchronous vs asynchronous

\* Centralized vs distributed

\* Build vs buy

\* Strong consistency vs eventual consistency

\* Lower operational complexity vs higher control

Do not force these categories.

Use only distinctions that are meaningful for the current problem.

**---**

**# Recommendations Should Reflect Known Constraints**

The recommendation must be based only on information available in the session.

Consider:

\* Repository evidence

\* Existing architecture

\* Team constraints stated by the player

\* Operational constraints

\* Performance requirements

\* Security requirements

\* Reliability requirements

\* Migration requirements

\* Cost considerations

Do not invent constraints.

Do not invent team capabilities.

Do not invent infrastructure.

**---**

**# What the Player Needs to Know**

The recommendation's \`what_to_know\` field should make uncertainty visible.

It should explain things such as:

\`\`\`text

This assumes...

\`\`\`

\`\`\`text

This becomes less attractive if...

\`\`\`

\`\`\`text

The decision would change if...

\`\`\`

\`\`\`text

The missing information is...

\`\`\`

This is important because the player should understand the reasoning behind the choices before entering a door.

**---**

**# Do Not Reveal Hidden Reasoning**

Provide concise engineering explanations.

Do not expose internal chain-of-thought.

The game should receive useful decision summaries, trade-offs, assumptions, and recommendations.

Do not send private model reasoning.

**---**

**# Repository Context**

When a repository is available, inspect relevant files before generating decisions.

Prioritize:

\`\`\`text

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

\`\`\`

Do not scan unrelated files unnecessarily.

Use actual repository evidence.

Do not invent files.

**---**

**# Repository-Aware Decisions**

Repository evidence should materially influence the options.

For example, if the repository already uses PostgreSQL:

Do not ask:

\`\`\`text

Which database should you use?

\`\`\`

without acknowledging the existing setup.

A better question could be:

\`\`\`text

The repository already uses PostgreSQL. Should the application continue using

the existing relational model directly, introduce another data-access layer,

or change the persistence strategy?

\`\`\`

The game should feel specific to the player's actual engineering problem.

**---**

**# Challenge Is Not a Separate Gameplay Stage**

The primary DevQuest game loop is:

\`\`\`text

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

\`\`\`

Do not insert a separate challenge/defense/evaluation stage into the primary flow unless the current game implementation explicitly adds one.

The selected option and the player's context are sufficient input for determining the next decision.

**---**

**# Reconsideration**

If the game sends:

\`\`\`text

RECONSIDER

\`\`\`

preserve the original decision.

Retrieve the session and use the previous decision as context.

Create a new decision with exactly four options.

Do not delete or overwrite the original branch.

The final document should preserve the fact that the player changed direction.

**---**

**# Maximum round limit**

DevQuest has a hard maximum of **\*\*7 decision rounds per session\*\***.

A round is one decision question sent to the game through:

\`\`\`text

POST /api/skill/decisions

\`\`\`

**# Finishing**

The skill should finish when:

\* Major engineering decisions are resolved

\* Important dependent decisions are resolved

\* Remaining decisions are routine or inconsequential

\* The resulting engineering direction is sufficiently defined

\* No meaningful next decision remains

\* Round 7 has been completed

Do not continue generating questions just to make the session longer.

A shorter meaningful decision tree is preferable to a long sequence of repetitive questions.

**---**

**# Final Decision**

When no meaningful decisions remain:

1\. Retrieve the full session.

2\. Synthesize the player's selected decisions.

3\. Derive the resulting engineering architecture.

4\. Convert that architecture into a concrete implementation plan.

5\. Generate the final implementation document.

6\. POST it to \`/api/skill/finish\`.

7\. Allow the game to transition to the Trophy Room.

The final document must synthesize the decisions rather than reproduce the interview.

Prioritize:

\- What was decided

\- What architecture results

\- How to implement it

\- How the implementation should be tested

\- What trade-offs and risks were accepted

Do not generate another decision after the final decision.

**---**

**# Final Decision Document**

The final document is an implementation plan derived from the engineering decisions made by the player.

The player should NOT receive a transcript of the interview.

Do NOT include:

\- Decision Chain

\- Q1 / Q2 / Q3 style interview transcripts

\- Repeated explanations of every option

\- Repeated recommendations for every round

\- Internal model reasoning

\- Questions that were already answered during the interview

The final document MUST explain how to proceed with the engineering problem using the architecture and decisions selected by the player.

Use this structure:

\`\`\`text

\# Problem Statement

The original engineering problem submitted by the player.

\# Architecture Outcome

A concise description of the final architecture resulting from the player's decisions.

Include the major selected decisions and how they fit together.

\# Implementation Plan

A concrete, ordered plan for building the solution.

The steps should be dependency-aware and actionable.

Each step should explain:

\- What needs to be built

\- Where it belongs in the system

\- Important implementation details

\- Dependencies on previous steps

Prefer implementation phases such as:

1\. Define configuration

2\. Define data model / storage

3\. Implement core algorithm

4\. Implement service layer

5\. Integrate with request flow

6\. Define API / client contract

7\. Implement failure handling

8\. Add observability

9\. Test and load test

10\. Production rollout considerations

Only include phases that are relevant to the actual engineering problem.

\# Request / Data Flow

Explain how the system behaves end-to-end.

Use a simple text diagram when useful.

Example:

Client

↓

API

↓

Rate Limiting Layer

↓

Redis

↓

Allow / Reject

↓

Response

\# API / Interface Contract

Describe important request, response, event, API, or component contracts that need to be implemented.

Include concrete examples when useful.

For HTTP systems, show relevant status codes, headers, or response bodies.

\# Testing and Validation

Describe how the implementation should be validated.

Include:

\- Functional tests

\- Edge cases

\- Concurrent request tests

\- Failure scenarios

\- Integration tests

\- Load/performance tests

\- Multi-instance tests when relevant

The testing plan must validate the requirements from the original problem.

\# Trade-offs Accepted

Describe the major trade-offs resulting from the player's selected decisions.

Each trade-off should connect directly to an implementation consequence.

\# Risks

List important technical risks that follow from the chosen architecture.

For each risk, explain what should be monitored or validated.

\# Open Questions

List only genuinely unresolved engineering questions.

If there are no meaningful unresolved questions, write:

None.

\`\`\`

The final document must be based on the player's actual decisions.

Do not replace the player's decisions with Claude's original recommendations.

If the player chose an option that differs from the recommendation, the implementation plan MUST build around the player's selected option and describe the consequences of that choice.

The document should answer:

\> "Given the engineering decisions I made, how should I actually build this?"

It should NOT answer:

\> "What decisions did I make during the interview?"

Do not invent implementation details that are unsupported by the problem, repository context, or decisions made during the session.

Reasonable implementation details may be derived from the selected architecture when they are necessary to explain how the chosen design would be built.

Do not expose hidden chain-of-thought.

**---**

**# Finish Request**

Send:

\`\`\`bash

curl -X POST http\://localhost:8000/api/skill/finish \\

-H "Content-Type: application/json" \\

-d '{

    "session_id": "\<sid>",

    "summary": "Final engineering direction summary",

    "doc_content": "\<full implementation plan markdown document>"

}'

\`\`\`

After this succeeds, the game transitions to the Trophy Room.

The Phaser game owns the visual Trophy Room experience.

**## Finish Payload Semantics**

\`summary\` is a concise description of the final engineering direction.

\`doc_content\` is the complete implementation plan shown in the Trophy Room.

Example:

\`\`\`json

{

"session_id": "\<sid>",

"summary": "Build the rate limiter using centralized Redis, a sliding-window log, IP-based keys, soft enforcement, adaptive backoff, and fail-open Redis failure handling.",

"doc_content": "\<full implementation plan>"

}

\`\`\`

Do not put the Decision Chain into either field.

**---**

**# Saving the Document**

When a repository path is available, save the document as:

\`\`\`text

docs/\<topic-slug>-decisions.md

\`\`\`

Example:

\`\`\`text

docs/auth-service-decisions.md

\`\`\`

The topic slug should:

\* Be lowercase

\* Use hyphens

\* Avoid special characters

\* Be concise

Only save information supported by the session.

**---**

**# Trophy Room**

After \`/api/skill/finish\` succeeds, the game handles the Trophy Room.

The Trophy Room may display:

\* Final summary

\* Decision count

\* Final engineering direction

\* Decision document

Claude Code does not control the Trophy Room presentation.

**---**

**# Session IDs**

Preserve the same session ID for the entire interview.

Use it for:

\`\`\`text

decision generation

event polling

session retrieval

finish

\`\`\`

Never create a new session simply because the player entered another room.

A complete DevQuest interview normally uses one session.

**---**

**# Node IDs**

Decision nodes identify individual decisions.

When the game provides:

\`\`\`text

nodeId

\`\`\`

preserve it.

Use it when determining the next decision's relationship to a previous decision.

**---**

**# Malformed Events**

If an event is malformed:

1\. Log a concise warning.

2\. Do not fabricate missing information.

3\. Continue polling if the session ID remains usable.

If the session ID cannot be determined, do not invent one.

**---**

**# Unknown Events**

For unknown event types:

1\. Log the event type.

2\. Do not make an engineering decision from it.

3\. Continue polling.

**---**

**# Player Inactivity**

The game is the primary interface.

Do not repeatedly send terminal messages while the player is inactive.

Do not make decisions for the player.

**---**

**# Health Checks**

Before starting or resuming:

\`\`\`bash

curl -s http\://localhost:8000/api/health

\`\`\`

If the server is unavailable:

1\. Start it.

2\. Check health again.

3\. Stop if startup fails.

Do not claim that a service is running when it is not reachable.

**---**

**# Game Health**

The game should be available at:

\`\`\`text

http\://localhost:5173

\`\`\`

If it is unavailable:

1\. Start the development server.

2\. Verify availability.

3\. Tell the user to open the URL if necessary.

**---**

**# Core Interview Loop**

The skill should continuously follow this loop:

\`\`\`text

1\. Receive problem

       ↓

2\. Understand problem

       ↓

3\. Inspect relevant context

       ↓

4\. Generate decision

       ↓

5\. Generate exactly 4 options

       ↓

6\. Explain decision

       ↓

7\. Explain each option

       ↓

8\. Give recommendation

       ↓

9\. Send decision to game

       ↓

10\. Wait for OPTION_SELECTED

       ↓

11\. Read selected option + optional context

       ↓

12\. Recalculate decision tree

       ↓

13\. Generate next decision

       ↓

14\. Repeat

       ↓

15\. Finish when no meaningful decision remains

       ↓

16\. Synthesize the selected architecture

       ↓

17\. Generate implementation plan

       ↓

18\. Send /finish

\`\`\`

The game handles:

\`\`\`text

Decision Room

Corridor

Options Room

Player movement

Door placement

Camera movement

Room alignment

Visual loading

Trophy Room

\`\`\`

The skill handles:

\`\`\`text

Engineering reasoning

Decision tree

Four options

Option explanations

Recommendation

Next decision

Final document

\`\`\`

**---**

**# Example End-to-End Session**

Problem:

\`\`\`text

Should we migrate our Node.js API to Go?

\`\`\`

First decision:

\`\`\`text

Question:

Should the API actually be rewritten?

Description:

The first decision is whether the migration solves a concrete problem.

The important constraints are current performance, development velocity,

operational cost, migration risk, and whether the current Node.js service

has a limitation that justifies a rewrite.

\`\`\`

Four options:

\`\`\`text

A Keep Node.js

B Rewrite in Go

C Rewrite only the performance-critical service

D Prototype the Go implementation first

\`\`\`

Player chooses:

\`\`\`text

C

\`\`\`

Optional context:

\`\`\`text

Most latency is coming from one request path.

\`\`\`

Claude should now use that information to generate a decision such as:

\`\`\`text

Question:

How should the performance-critical path be isolated from the existing service?

A Extract it into a Go service

B Optimize the existing Node.js path

C Move the path behind an asynchronous worker

D Replace the path with a managed service

\`\`\`

The game creates the Corridor while Claude generates the response.

Once the response is ready, the game creates the next Options Room.

The loop continues.

**---**

**# Final Synthesis Rules**

The final document must transform the player's decisions into an engineering execution plan.

For each major decision, determine:

1\. What the player selected

2\. What component of the architecture it affects

3\. What implementation consequence follows

4\. What dependency it creates

5\. What must be validated

Then combine those consequences into one coherent architecture.

Example:

Player selected:

\- Redis

\- Sliding-window log

\- IP-based identity

\- Soft enforcement

\- Adaptive backoff

\- Fail-open Redis handling

Do NOT produce:

\`\`\`text

Q1 → Redis

Q2 → Sliding-window log

Q3 → IP

Q4 → Soft enforcement

...

\`\`\`

Instead produce:

\`\`\`text

Architecture Outcome

→ Centralized Redis rate-limit state

→ Sliding-window request tracking

→ IP-based rate-limit keys

→ Asynchronous enforcement

→ Adaptive retry behaviour

→ Fail-open Redis failure mode

Implementation Plan

→ Configure limits

→ Implement Redis data model

→ Implement atomic rate-limit operation

→ Create rate limiter service

→ Integrate middleware/request lifecycle

→ Add 429 contract

→ Add adaptive backoff

→ Add Redis failure handling

→ Add observability

→ Load test at required traffic

\`\`\`

The final output should connect decisions to implementation.

Do not simply restate the decisions.

**---**

**# Do Not**

Do not:

\* Generate fewer or more than four options

\* Generate filler options

\* Generate unrelated questions

\* Ignore previous decisions

\* Ignore the player's additional context

\* Repeat a previous question without a reason

\* Put game-layout logic in the skill

\* Put engineering reasoning in Phaser

\* Create unnecessary gameplay stages

\* Invent repository information

\* Invent player preferences

\* Invent constraints

\* Force the player to choose the recommendation

\* Continue the session after the meaningful decision tree is complete

**---**

**# Final Principles**

1\. The player makes the engineering decisions.

2\. Claude provides the decision framework.

3\. Every decision has exactly four options: A, B, C, and D.

4\. Every option has a concise explanation.

5\. Every decision has a concise description explaining why it matters.

6\. Every decision has a recommendation.

7\. Every recommendation explains why it fits the known constraints.

8\. Every recommendation explains what information could change the decision.

9\. The player's optional context must influence the next decision.

10\. Every new decision should build on the previous decision when relevant.

11\. The game is responsible for all visual room and corridor behavior.

12\. FastAPI is the communication broker.

13\. Do not add challenge/defense/evaluation stages unless the game explicitly requires them.

14\. Do not invent engineering decisions in the game.

15\. Do not pad the interview with unnecessary questions.

16\. Finish when the meaningful engineering decision tree is complete.

17\. Preserve the player's actual decision history.

18\. The final document must reflect the decisions made during the session.

19\. The game remains the primary interface throughout the interview.
