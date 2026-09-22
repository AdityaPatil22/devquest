export type Direction = 'north' | 'south' | 'east' | 'west';
export type ConnectionKind = 'entrance' | 'exit';
export type RoomKind = 'common' | 'decision' | 'corridor' | 'random' | 'trophy';

export interface Point { x: number; y: number; }
export interface Size { width: number; height: number; }
export interface Rect extends Point, Size {}

export interface ConnectionPoint {
  id: string;
  kind: ConnectionKind;
  direction: Direction;
  position: Point;
}

export interface Room {
  readonly id: string;
  readonly kind: RoomKind;
  readonly mapKey: string;
  readonly bounds: Rect;
  readonly connections: readonly ConnectionPoint[];
  getEntrance(id?: string): ConnectionPoint | undefined;
  getExit(id?: string): ConnectionPoint | undefined;
  getConnections(direction?: Direction): readonly ConnectionPoint[];
}

export interface RoomDefinition {
  id: string;
  kind: RoomKind;
  mapKey: string;
  position: Point;
  size: Size;
  connections: ConnectionPoint[];
}

export class RoomInstance implements Room {
  readonly id: string;
  readonly kind: RoomKind;
  readonly mapKey: string;
  readonly bounds: Rect;
  readonly connections: readonly ConnectionPoint[];

  constructor(definition: RoomDefinition) {
    this.id = definition.id;
    this.kind = definition.kind;
    this.mapKey = definition.mapKey;
    this.bounds = { ...definition.position, ...definition.size };
    this.connections = definition.connections.map((connection) => ({
      ...connection,
      position: { ...connection.position },
    }));
  }

  getEntrance(id?: string): ConnectionPoint | undefined {
    return this.findConnection('entrance', id);
  }

  getExit(id?: string): ConnectionPoint | undefined {
    return this.findConnection('exit', id);
  }

  getConnections(direction?: Direction): readonly ConnectionPoint[] {
    const connections = direction
      ? this.connections.filter((connection) => connection.direction === direction)
      : this.connections;
    return connections.map((connection) => ({ ...connection, position: { ...connection.position } }));
  }

  private findConnection(kind: ConnectionKind, id?: string): ConnectionPoint | undefined {
    const connection = this.connections.find(
      (item) => item.kind === kind && (id === undefined || item.id === id),
    );
    return connection
      ? { ...connection, position: { ...connection.position } }
      : undefined;
  }
}