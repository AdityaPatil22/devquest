import { describe, expect, it } from 'vitest';
import { DecisionState } from '../src/state/DecisionState';
import { PlayerState } from '../src/state/PlayerState';
import { WorldState } from '../src/state/WorldState';
import { SessionStore } from '../src/state/SessionStore';
import type { SessionSnapshot } from '../src/net/protocol';

describe('game state models', () => {
  it('keeps generated room metadata independent from player and decision state', () => {
    const world = new WorldState();
    const player = new PlayerState();
    const decision = new DecisionState();

    world.registerRoom({
      id: 'room-1',
      mapKey: 'room-1',
      kind: 'random',
      variant: '1',
      order: 1,
      generatedAt: 123,
      metadata: { seed: 'abc', connected: true },
    });

    player.setRoom('room-1');
    player.setPosition(48, 64);

    decision.setDecision({
      nodeId: 'node-1',
      question: 'Which option?',
      options: [{ id: 'a', label: 'A' }],
      round: 1,
    });
    decision.selectOption('a', 'Because A fits.');

    expect(world.currentRoomId).toBe('room-1');
    expect(world.rooms[0]?.metadata?.seed).toBe('abc');
    expect(player.currentRoomId).toBe('room-1');
    expect(player.position).toEqual({ x: 48, y: 64 });
    expect(decision.selectedOptionId).toBe('a');

    player.setPosition(80, 96);

    expect(world.rooms[0]?.metadata?.seed).toBe('abc');
    expect(decision.selectedOptionId).toBe('a');
  });

  it('preserves decision state when the world advances to another room', () => {
    const world = new WorldState();
    const decision = new DecisionState();

    decision.setDecision({
      nodeId: 'node-2',
      question: 'Pick a path',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      round: 2,
    });
    decision.selectOption('b', 'Prefer the lower-risk path.');

    world.registerRoom({
      id: 'corridor-1',
      mapKey: 'corridor',
      kind: 'corridor',
      order: 1,
      generatedAt: 1,
    });
    world.registerRoom({
      id: 'room-2',
      mapKey: 'room-2',
      kind: 'random',
      order: 2,
      generatedAt: 2,
    });
    world.advanceProgression();

    expect(world.currentRoomId).toBe('room-2');
    expect(world.progressionIndex).toBe(1);
    expect(decision.selectedOptionId).toBe('b');
    expect(decision.context).toBe('Prefer the lower-risk path.');
  });
});


  it('hydrates world and player state after multiple generated rooms', () => {
    const store = new SessionStore();
    const snapshot: SessionSnapshot = {
      sessionId: 'session-1',
      phase: 'awaiting_challenge',
      round: 3,
      currentNodeId: 'node-3',
      decisions: [{
        id: 'node-3',
        question: 'Which path?',
        options: [{ id: 'opt-a', label: 'A' }, { id: 'opt-b', label: 'B' }],
        round: 3,
        status: 'decided',
        decision: { optionId: 'opt-b', context: 'Prefer B.' },
      }],
      world: {
        rooms: [
          { id: 'common-room', mapKey: 'common', kind: 'common', order: 0, generatedAt: 1 },
          { id: 'decision-room', mapKey: 'decision', kind: 'decision', order: 1, generatedAt: 2 },
          { id: 'corridor-1', mapKey: 'corridor', kind: 'corridor', order: 2, generatedAt: 3 },
          { id: 'room-1', mapKey: 'room-1', kind: 'random', variant: '1', order: 3, generatedAt: 4 },
          { id: 'corridor-2', mapKey: 'corridor', kind: 'corridor', order: 4, generatedAt: 5 },
          { id: 'room-2', mapKey: 'room-2', kind: 'random', variant: '2', order: 5, generatedAt: 6 },
        ],
        currentRoomId: 'room-2',
        progressionIndex: 2,
      },
      player: {
        position: { x: 3152, y: 240 },
        currentRoomId: 'room-2',
        completedRooms: ['room-1'],
      },
    };

    store.hydrate(snapshot);

    expect(store.worldState.rooms.map((room) => room.id)).toEqual([
      'common-room',
      'decision-room',
      'corridor-1',
      'room-1',
      'corridor-2',
      'room-2',
    ]);
    expect(store.worldState.currentRoomId).toBe('room-2');
    expect(store.worldState.progressionIndex).toBe(2);
    expect(store.playerState.position).toEqual({ x: 3152, y: 240 });
    expect(store.playerState.currentRoomId).toBe('room-2');
    expect(store.playerState.completedRooms).toEqual(['room-1']);
    expect(store.getCurrentDecision()?.selectedOptionId).toBe('opt-b');
  });
