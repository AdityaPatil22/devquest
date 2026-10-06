# DevQuest Gameplay

This document describes the gameplay implemented by the current `master` branch.

## Core Loop

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
Corridor generated
   ↓
Player walks through Corridor while Claude generates the next decision
   ↓
Next decision received
   ↓
Options Room generated
   ↓
Player enters Options Room
   ↓
Player selects another option
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
Trophy Room
```

The Decision Room → Corridor → Options Room loop is the defining experience of DevQuest.

## BootScene

The initial game loads into `BootScene`.

The boot interface provides:

- DevQuest branding
- an explanation of the game
- gameplay instructions
- system status
- engineering problem input

The player enters the problem in the game UI. The problem is then submitted to the DevQuest session through the game connection.

## GrillingScene

After the problem is submitted, the game enters `GrillingScene`.

The first environment contains the Decision Room.

The current backend contract provides exactly four options:

```text
A
B
C
D
```

Each option contains a label and description. Claude can also provide a recommendation and supporting reasoning.

## Choosing a Door

The player walks to the door representing the option they want.

Pressing **E** opens the context interaction.

The player can provide additional context before confirming the choice.

The game sends:

- the selected option
- the current decision
- optional player context

back through the session transport.

## Corridor Processing

The Corridor is generated immediately after a decision is selected.

Its purpose is both visual and functional: it gives Claude time to generate the next meaningful decision while the player continues moving through the world.

The Corridor exit remains blocked until the next decision is ready.

This avoids a traditional loading screen between decisions.

## Options Room

When the next decision arrives:

1. the game receives the decision,
2. the Corridor becomes ready,
3. the exit unlocks,
4. the Options Room is generated and aligned with the Corridor,
5. the player enters the room and sees the next four doors.

The loop then repeats.

## When Does the Game Finish?

There is no fixed number of rounds that determines completion.

Claude decides when another decision would no longer materially improve the implementation plan.

At that point:

```text
Final decision
     ↓
Document generation
     ↓
Trophy Room
```

The game enters a final-document-generation state while the implementation plan is prepared.

## Trophy Room

The Trophy Room is the completion state of a DevQuest session.

It presents the final implementation plan generated from the decisions and context collected during the session.

The result is intended to bridge the gap between:

```text
Ambiguous problem
      ↓
Constraints
      ↓
Engineering decisions
      ↓
Trade-offs
      ↓
Implementation direction
```

## Player vs Claude

The player remains the final decision maker.

Claude is responsible for:

- identifying meaningful decisions,
- generating four realistic options,
- explaining trade-offs,
- recommending an option,
- using the selected option and context to determine what to explore next,
- deciding when enough information exists,
- generating the final implementation plan.

The game is responsible for presenting that reasoning as an interactive world.
