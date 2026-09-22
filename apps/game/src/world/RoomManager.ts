import { TiledRoomFactory } from './RoomFactory';
import type { ConnectionPoint, Direction, Point, RoomInstance, Size } from './Room';

export type ManagedRoomKind = 'common' | 'decision' | 'corridor' | 'random';

export interface RoomPlacementSpec {
  id: string;
  kind: ManagedRoomKind;
  mapKey: string;
  size: Size;
  connections?: ConnectionPoint[];
  attachTo?: {
    roomId: string;
    connectionId?: string;
  };
}

export interface ManagedRoom {
  readonly room: RoomInstance;
  readonly index: number;
}

export interface RoomConnection {
  readonly fromRoomId: string;
  readonly fromConnectionId: string;
  readonly toRoomId: string;
  readonly toConnectionId: string;
}

export interface RoomManagerSnapshot {
  readonly rooms: readonly ManagedRoom[];
  readonly connections: readonly RoomConnection[];
}

export interface RoomManagerOptions {
  readonly gap: number;
  readonly origin?: { x: number; y: number };
}

export class RoomManager {
  private readonly factory: TiledRoomFactory;
  private readonly rooms = new Map<string, ManagedRoom>();
  private readonly connections: RoomConnection[] = [];
  private readonly gap: number;
  private nextIndex = 0;
  private cursorX: number;
  private readonly cursorY: number;

  constructor(factory = new TiledRoomFactory(), options: RoomManagerOptions = { gap: 0 }) {
    this.factory = factory;
    this.gap = options.gap;
    this.cursorX = options.origin?.x ?? 0;
    this.cursorY = options.origin?.y ?? 0;
  }

  addRoom(spec: RoomPlacementSpec): RoomInstance {
    if (this.rooms.has(spec.id)) {
      throw new Error(`Room "${spec.id}" already exists`);
    }

    const position = spec.attachTo
      ? this.positionFromConnection(spec.attachTo.roomId, spec.attachTo.connectionId, spec.connections?.find((connection) => connection.kind === 'entrance'))
      : { x: this.cursorX, y: this.cursorY };

    const room = this.factory.createFromBounds({
      id: spec.id,
      kind: spec.kind,
      mapKey: spec.mapKey,
      position,
      size: spec.size,
      connections: spec.connections ?? [],
    });

    const managed: ManagedRoom = { room, index: this.nextIndex++ };
    this.rooms.set(room.id, managed);
    this.cursorX = Math.max(this.cursorX, room.bounds.x + room.bounds.width + this.gap);

    return room;
  }

  addNextRoom(
    spec: Omit<RoomPlacementSpec, 'connections'> & { connections?: ConnectionPoint[] },
  ): RoomInstance {
    return this.addRoom(spec);
  }

  connect(
    fromRoomId: string,
    fromConnectionId: string,
    toRoomId: string,
    toConnectionId: string,
  ): RoomConnection {
    const fromRoom = this.getRoom(fromRoomId);
    const toRoom = this.getRoom(toRoomId);
    const from = fromRoom.getExit(fromConnectionId) ?? fromRoom.getEntrance(fromConnectionId);
    const to = toRoom.getEntrance(toConnectionId) ?? toRoom.getExit(toConnectionId);

    if (!from) {
      throw new Error(`Connection "${fromConnectionId}" was not found on room "${fromRoomId}"`);
    }

    if (!to) {
      throw new Error(`Connection "${toConnectionId}" was not found on room "${toRoomId}"`);
    }

    if (!this.areCompatible(from.direction, to.direction)) {
      throw new Error(
        `Connections "${fromConnectionId}" and "${toConnectionId}" are not compatible`,
      );
    }

    const connection: RoomConnection = {
      fromRoomId,
      fromConnectionId,
      toRoomId,
      toConnectionId,
    };

    const exists = this.connections.some(
      (item) =>
        item.fromRoomId === connection.fromRoomId &&
        item.fromConnectionId === connection.fromConnectionId &&
        item.toRoomId === connection.toRoomId &&
        item.toConnectionId === connection.toConnectionId,
    );

    if (!exists) {
      this.connections.push(connection);
    }

    return connection;
  }

  connectSequentially(
    previousRoomId: string,
    previousExitId: string,
    nextRoomId: string,
    nextEntranceId: string,
  ): RoomConnection {
    return this.connect(previousRoomId, previousExitId, nextRoomId, nextEntranceId);
  }

  getRoom(id: string): RoomInstance {
    const managed = this.rooms.get(id);
    if (!managed) {
      throw new Error(`Room "${id}" does not exist`);
    }
    return managed.room;
  }

  getRoomAt(index: number): RoomInstance | undefined {
    return Array.from(this.rooms.values()).find((managed) => managed.index === index)?.room;
  }

  getRooms(kind?: ManagedRoomKind): readonly RoomInstance[] {
    const rooms = Array.from(this.rooms.values())
      .sort((a, b) => a.index - b.index)
      .map(({ room }) => room);

    return kind ? rooms.filter((room) => room.kind === kind) : rooms;
  }

  getConnections(): readonly RoomConnection[] {
    return this.connections.map((connection) => ({ ...connection }));
  }

  getLastRoom(): RoomInstance | undefined {
    return this.getRoomAt(this.nextIndex - 1);
  }

  clear(): void {
    this.rooms.clear();
    this.connections.length = 0;
    this.nextIndex = 0;
    this.cursorX = 0;
  }

  snapshot(): RoomManagerSnapshot {
    return {
      rooms: Array.from(this.rooms.values()).sort((a, b) => a.index - b.index),
      connections: this.getConnections(),
    };
  }

  get worldEndX(): number {
    return this.getLastRoom()?.bounds.x ?? 0;
  }

  get nextX(): number {
    return this.cursorX;
  }

  private positionFromConnection(
    roomId: string,
    connectionId: string | undefined,
    entrance: ConnectionPoint | undefined,
  ): Point {
    if (!entrance) {
      throw new Error(`An entrance connection is required when attaching room "${roomId}"`);
    }

    const previous = this.getRoom(roomId);
    const previousConnection = previous.getExit(connectionId);

    if (!previousConnection) {
      throw new Error(`Exit "${connectionId ?? ''}" was not found on room "${roomId}"`);
    }

    if (!this.areCompatible(previousConnection.direction, entrance.direction)) {
      throw new Error(
        `Connections "${previousConnection.id}" and "${entrance.id}" are not compatible`,
      );
    }

    const targetX = previous.bounds.x + previousConnection.position.x;
    const targetY = previous.bounds.y + previousConnection.position.y;

    switch (previousConnection.direction) {
      case 'east':
        return {
          x: targetX - entrance.position.x,
          y: targetY - entrance.position.y,
        };
      case 'west':
        return {
          x: targetX - entrance.position.x,
          y: targetY - entrance.position.y,
        };
      case 'north':
      case 'south':
        return {
          x: targetX - entrance.position.x,
          y: targetY - entrance.position.y,
        };
    }
  }

  private areCompatible(from: Direction, to: Direction): boolean {
    return (
      (from === 'east' && to === 'west') ||
      (from === 'west' && to === 'east') ||
      (from === 'north' && to === 'south') ||
      (from === 'south' && to === 'north')
    );
  }
}
