import { describe, expect, it } from 'vitest';
import { RoomInstance } from '../src/world/Room';
import { TiledRoomFactory } from '../src/world/RoomFactory';

describe('Room abstractions', () => {
  it('exposes entrances, exits, dimensions, and position without raw Tiled details', () => {
    const room = new RoomInstance({
      id: 'room-a',
      kind: 'decision',
      mapKey: 'some-room-map',
      position: { x: 160, y: 32 },
      size: { width: 512, height: 320 },
      connections: [
        { id: 'west-entrance', kind: 'entrance', direction: 'west', position: { x: 0, y: 160 } },
        { id: 'east-exit', kind: 'exit', direction: 'east', position: { x: 512, y: 160 } },
      ],
    });

    expect(room.bounds).toEqual({ x: 160, y: 32, width: 512, height: 320 });
    expect(room.getEntrance()).toEqual({
      id: 'west-entrance',
      kind: 'entrance',
      direction: 'west',
      position: { x: 0, y: 160 },
    });
    expect(room.getExit()).toEqual({
      id: 'east-exit',
      kind: 'exit',
      direction: 'east',
      position: { x: 512, y: 160 },
    });
    expect(room.getConnections('east')).toHaveLength(1);
  });

  it('keeps connection points independent of a room JSON filename', () => {
    const factory = new TiledRoomFactory();
    const room = factory.createFromBounds({
      id: 'generated-room-1',
      kind: 'random',
      mapKey: 'generated-map-key',
      position: { x: 0, y: 0 },
      size: { width: 1120, height: 480 },
      connections: [
        { id: 'north-exit', kind: 'exit', direction: 'north', position: { x: 560, y: 0 } },
        { id: 'east-exit', kind: 'exit', direction: 'east', position: { x: 1120, y: 240 } },
      ],
    });

    expect(room.mapKey).toBe('generated-map-key');
    expect(room.getExit('north-exit')?.direction).toBe('north');
    expect(room.getExit('east-exit')?.position).toEqual({ x: 1120, y: 240 });
  });

  it('does not expose mutable connection internals', () => {
    const room = new RoomInstance({
      id: 'room-safe',
      kind: 'corridor',
      mapKey: 'corridor',
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      connections: [
        { id: 'east', kind: 'exit', direction: 'east', position: { x: 100, y: 25 } },
      ],
    });

    const exit = room.getExit('east')!;
    exit.position.x = 999;

    expect(room.getExit('east')?.position.x).toBe(100);
  });
});
