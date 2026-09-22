import { RoomInstance, type RoomDefinition, type Rect } from './Room';

export interface TilemapRoomSpec {
  id: string;
  kind: string;
  mapKey: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  connections?: RoomDefinition['connections'];
}

export class TiledRoomFactory {
  createFromBounds(spec: TilemapRoomSpec): RoomInstance {
    return new RoomInstance({
      ...spec,
      connections: spec.connections ?? [],
    });
  }

  static boundsFromRect(rect: Rect): Rect {
    return { ...rect };
  }
}
