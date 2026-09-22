import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/world/RoomManager';

describe('RoomManager', () => {
  it('places rooms sequentially with a deterministic gap', () => {
    const manager = new RoomManager(undefined, { gap: 16 });

    const common = manager.addRoom({
      id: 'common-room',
      kind: 'common',
      mapKey: 'common-map',
      size: { width: 100, height: 64 },
      connections: [
        { id: 'common-exit', kind: 'exit', direction: 'east', position: { x: 100, y: 32 } },
      ],
    });

    const corridor = manager.addRoom({
      id: 'corridor-1',
      kind: 'corridor',
      mapKey: 'corridor',
      size: { width: 40, height: 32 },
      connections: [
        { id: 'corridor-west', kind: 'entrance', direction: 'west', position: { x: 0, y: 16 } },
        { id: 'corridor-east', kind: 'exit', direction: 'east', position: { x: 40, y: 16 } },
      ],
    });

    const room = manager.addRoom({
      id: 'room-1',
      kind: 'random',
      mapKey: 'room-1',
      size: { width: 80, height: 48 },
      connections: [
        { id: 'room-west', kind: 'entrance', direction: 'west', position: { x: 0, y: 24 } },
      ],
    });

    expect(common.bounds.x).toBe(0);
    expect(corridor.bounds.x).toBe(116);
    expect(room.bounds.x).toBe(172);
    expect(manager.getRooms()).toHaveLength(3);
    expect(manager.getRoom('corridor-1')).toBe(corridor);
    expect(manager.getLastRoom()).toBe(room);
  });

  it('connects exits to entrances and rejects incompatible directions', () => {
    const manager = new RoomManager(undefined, { gap: 8 });

    manager.addRoom({
      id: 'corridor-1',
      kind: 'corridor',
      mapKey: 'corridor',
      size: { width: 32, height: 32 },
      connections: [
        { id: 'exit', kind: 'exit', direction: 'east', position: { x: 32, y: 16 } },
      ],
    });

    manager.addRoom({
      id: 'room-1',
      kind: 'random',
      mapKey: 'room-1',
      size: { width: 32, height: 32 },
      connections: [
        { id: 'entrance', kind: 'entrance', direction: 'west', position: { x: 0, y: 16 } },
      ],
    });

    expect(
      manager.connectSequentially('corridor-1', 'exit', 'room-1', 'entrance'),
    ).toEqual({
      fromRoomId: 'corridor-1',
      fromConnectionId: 'exit',
      toRoomId: 'room-1',
      toConnectionId: 'entrance',
    });

    expect(() =>
      manager.connect(
        'corridor-1',
        'exit',
        'room-1',
        'entrance',
      ),
    ).not.toThrow();

    expect(manager.getConnections()).toHaveLength(1);

    manager.addRoom({
      id: 'north-room',
      kind: 'random',
      mapKey: 'north-room',
      size: { width: 32, height: 32 },
      connections: [
        { id: 'north-entrance', kind: 'entrance', direction: 'north', position: { x: 16, y: 0 } },
      ],
    });

    expect(() =>
      manager.connect('corridor-1', 'exit', 'north-room', 'north-entrance'),
    ).toThrow(/not compatible/);
  });

  it('attaches the next room to the previous exit and adapts to changed dimensions', () => {
    const manager = new RoomManager(undefined, { gap: 0 });

    const first = manager.addRoom({
      id: 'first',
      kind: 'corridor',
      mapKey: 'corridor',
      size: { width: 120, height: 64 },
      connections: [
        { id: 'east', kind: 'exit', direction: 'east', position: { x: 120, y: 32 } },
      ],
    });

    const second = manager.addRoom({
      id: 'second',
      kind: 'random',
      mapKey: 'room-1',
      size: { width: 80, height: 48 },
      attachTo: { roomId: 'first', connectionId: 'east' },
      connections: [
        { id: 'west', kind: 'entrance', direction: 'west', position: { x: 0, y: 24 } },
      ],
    });

    expect(second.bounds.x).toBe(first.bounds.x + first.bounds.width);
    expect(second.bounds.y + 24).toBe(first.bounds.y + 32);
  });

  it('rejects overlapping room geometry', () => {
    const manager = new RoomManager(undefined, { gap: 0 });

    manager.addRoom({
      id: 'first',
      kind: 'corridor',
      mapKey: 'corridor',
      size: { width: 100, height: 100 },
    });

    expect(() =>
      manager.addRoom({
        id: 'overlap',
        kind: 'random',
        mapKey: 'room-1',
        size: { width: 50, height: 50 },
        attachTo: undefined,
      }),
    ).toThrow(/overlaps/);
  });

  it('can inspect and clear generated rooms independently of rendering', () => {
    const manager = new RoomManager();

    manager.addNextRoom({
      id: 'common-room',
      kind: 'common',
      mapKey: 'common-map',
      size: { width: 20, height: 20 },
    });

    manager.addNextRoom({
      id: 'corridor-1',
      kind: 'corridor',
      mapKey: 'corridor',
      size: { width: 20, height: 20 },
    });

    expect(manager.getRooms('corridor')).toHaveLength(1);
    expect(manager.snapshot().rooms).toHaveLength(2);

    manager.clear();

    expect(manager.getRooms()).toHaveLength(0);
    expect(manager.getConnections()).toHaveLength(0);
    expect(manager.nextX).toBe(0);
  });
});
