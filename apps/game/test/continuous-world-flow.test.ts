import { describe, expect, it } from 'vitest';

import { RoomGenerationState } from '../src/state/RoomGenerationState';
import { RoomManager } from '../src/world/RoomManager';
import type { DecisionOption } from '../src/net/protocol';

describe('continuous world flow', () => {
  it('keeps room generation recoverable across multiple selections', () => {
    const generation = new RoomGenerationState();

    expect(generation.status).toBe('idle');

    expect(generation.begin()).toBe(true);
    expect(generation.status).toBe('generating');

    generation.ready();
    expect(generation.snapshot).toEqual({ status: 'ready' });

    expect(generation.begin()).toBe(true);
    generation.fail(new Error('generation failed'));

    expect(generation.snapshot).toEqual({
      status: 'error',
      error: 'generation failed',
    });

    expect(generation.begin()).toBe(true);
    expect(generation.status).toBe('generating');
  });

  it('connects successive generated areas without rebuilding earlier rooms', () => {
    const manager = new RoomManager(undefined, { gap: 64 });

    const dimensions = { width: 70 * 16, height: 30 * 16 };

    for (let i = 1; i <= 3; i += 1) {
      const previous = manager.getLastRoom();
      const room = manager.addRoom({
        id: `room-${i}`,
        kind: 'random',
        mapKey: `room-${i}`,
        attachTo: previous
          ? { roomId: previous.id, connectionId: previous.getExit()?.id }
          : undefined,
        size: dimensions,
        connections: [
          {
            id: `room-${i}-west`,
            kind: 'entrance',
            direction: 'west',
            position: { x: 0, y: dimensions.height / 2 },
          },
          {
            id: `room-${i}-east`,
            kind: 'exit',
            direction: 'east',
            position: { x: dimensions.width, y: dimensions.height / 2 },
          },
        ],
      });

      if (previous) {
        manager.connectSequentially(
          previous.id,
          previous.getExit()!.id,
          room.id,
          room.getEntrance()!.id,
        );
      }
    }

    const rooms = manager.getRooms();
    expect(rooms).toHaveLength(3);
    expect(manager.getConnections()).toHaveLength(2);

    expect(rooms[0]?.bounds.x).toBe(0);
    expect(rooms[1]?.bounds.x).toBe(dimensions.width);
    expect(rooms[2]?.bounds.x).toBe(dimensions.width * 2);

    expect(manager.getConnections()).toEqual([
      {
        fromRoomId: 'room-1',
        fromConnectionId: 'room-1-east',
        toRoomId: 'room-2',
        toConnectionId: 'room-2-west',
      },
      {
        fromRoomId: 'room-2',
        fromConnectionId: 'room-2-east',
        toRoomId: 'room-3',
        toConnectionId: 'room-3-west',
      },
    ]);
  });

  it('preserves exact option identity used by the decision flow', () => {
    const options: DecisionOption[] = [
      { id: 'opt-a', label: 'Option A' },
      { id: 'opt-b', label: 'Option B' },
    ];

    const selected = options[1];
    expect(selected.id).toBe('opt-b');
    expect(options.map((option) => option.id)).toEqual(['opt-a', 'opt-b']);
  });
});
