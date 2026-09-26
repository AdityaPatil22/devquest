import type { DecisionTilesetDef } from './decisionRoomTilemap';

export const CORRIDOR_TILEMAP_KEY = 'corridor-map';

export const CORRIDOR_TILEMAP_PATH =
  'assets/map/corridor/corridor.json';

export const CORRIDOR_MAP_TILE_SIZE = 16;

export const CORRIDOR_TILESETS: DecisionTilesetDef[] = [
  {
    name: 'FloorAndGround16',
    key: 'tileset-floor-and-ground-16',
    path: 'assets/map/FloorAndGround.png',
    firstgid: 1,
    columns: 128,
    imagewidth: 2048,
    imageheight: 1280,
    tilecount: 10240,
  },
  {
    name: 'ModernOfficeBlackShadow16',
    key: 'tileset-modern-office-16',
    path: 'assets/items/Modern_Office_Black_Shadow.png',
    firstgid: 10241,
    columns: 32,
    imagewidth: 512,
    imageheight: 1696,
    tilecount: 3392,
  },
  {
    name: 'FloorAndGround16B',
    key: 'tileset-floor-and-ground-16',
    path: 'assets/map/FloorAndGround.png',
    firstgid: 13633,
    columns: 128,
    imagewidth: 2048,
    imageheight: 1280,
    tilecount: 10240,
  },
  {
    name: 'Generic16',
    key: 'tileset-generic-16',
    path: 'assets/items/Generic.png',
    firstgid: 23873,
    columns: 32,
    imagewidth: 512,
    imageheight: 2496,
    tilecount: 4992,
  },
  {
    name: 'Basement16',
    key: 'tileset-basement-16',
    path: 'assets/items/Basement.png',
    firstgid: 28865,
    columns: 32,
    imagewidth: 512,
    imageheight: 1600,
    tilecount: 3200,
  },
];

export const CORRIDOR_TILE_LAYERS = [
  'Floor',
  'Walls',
  'furniture',
  'computers',
] as const;

export const CORRIDOR_COLLIDABLE_LAYER = 'Walls';

/**
 * Bounds of the authored infinite corridor map.
 *
 * The Tiled map uses chunks starting at y = -16 and extending
 * through y = 47.
 */
export const CORRIDOR_MAP_BOUNDS = {
  minTileX: 0,
  maxTileX: 31,
  minTileY: -16,
  maxTileY: 47,
};

/**
 * Connection markers from the Tiled corridor map.
 *
 * These coordinates are in Tiled/world pixels and should be treated
 * as the source of truth for connecting the corridor to adjacent rooms.
 */
export const CORRIDOR_MARKERS = {
  /**
   * Bottom entrance coming from the Decision Room.
   *
   * Tiled marker:
   * x = 271.814278436795
   * y = 625.136452951022
   * width = 32.03143876
   * height = 30.21206608
   */
  entrance: {
    name: 'corridor-enterance',
    type: 'RoomEntrance',
    x: 271.814278436795,
    y: 625.136452951022,
    width: 32.03143876,
    height: 30.21206608,
  },

  /**
   * Top exit leading toward the next Option Room.
   */
  exit: {
    name: 'corridor-exit',
    type: '',
    x: 273.382111054393,
    y: -159.378367647893,
    width: 45.374624241393,
    height: 61.822925528898,
  },

  /**
   * Explicit RoomExit marker from Tiled.
   */
  roomExit: {
    name: '',
    type: 'RoomExit',
    x: 272.083642051535,
    y: -159.298592244999,
    width: 47.748415246563,
    height: 62.5668889437721,
  },

  /**
   * Player spawn point inside the corridor.
   */
  spawn: {
    name: 'corridor-starting-point',
    type: 'SpawnPoint',
    x: 256.36662696387,
    y: 592.138846350179,
    width: 63.435312801,
    height: 30.06068856,
  },
} as const;

/**
 * Center point of the corridor spawn marker.
 */
export const CORRIDOR_SPAWN = {
  x:
    CORRIDOR_MARKERS.spawn.x +
    CORRIDOR_MARKERS.spawn.width / 2,

  y:
    CORRIDOR_MARKERS.spawn.y +
    CORRIDOR_MARKERS.spawn.height / 2,
};

/**
 * Center point of the Decision Room connection.
 *
 * Use this rather than hardcoding a separate entrance coordinate.
 */
export const CORRIDOR_ENTRANCE = {
  x:
    CORRIDOR_MARKERS.entrance.x +
    CORRIDOR_MARKERS.entrance.width / 2,

  y:
    CORRIDOR_MARKERS.entrance.y +
    CORRIDOR_MARKERS.entrance.height / 2,
};

/**
 * Center point of the corridor exit.
 */
export const CORRIDOR_EXIT = {
  x:
    CORRIDOR_MARKERS.roomExit.x +
    CORRIDOR_MARKERS.roomExit.width / 2,

  y:
    CORRIDOR_MARKERS.roomExit.y +
    CORRIDOR_MARKERS.roomExit.height / 2,
};

interface CorridorTileChunk {
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
}

interface CorridorTileLayer {
  type?: string;
  name?: string;
  chunks?: CorridorTileChunk[];
}

export function patchCorridorTilesets(rawMapJson: {
  tilesets: unknown[];
  layers?: CorridorTileLayer[];
}): void {
  rawMapJson.tilesets = CORRIDOR_TILESETS.map((tileset) => ({
    firstgid: tileset.firstgid,
    name: tileset.name,
    image: tileset.path.split('/').pop(),
    imagewidth: tileset.imagewidth,
    imageheight: tileset.imageheight,
    columns: tileset.columns,
    tilecount: tileset.tilecount,
    tilewidth: CORRIDOR_MAP_TILE_SIZE,
    tileheight: CORRIDOR_MAP_TILE_SIZE,
    margin: 0,
    spacing: 0,
  }));
}