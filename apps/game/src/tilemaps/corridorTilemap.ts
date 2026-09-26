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

/**
 * Layers present in the updated corridor map.
 */
export const CORRIDOR_TILE_LAYERS = [
  'Floor',
  'Walls',
  'furniture',
  'computers',
];

/**
 * Layer containing blocking tiles.
 */
export const CORRIDOR_COLLIDABLE_LAYER = 'Walls';

/**
 * Actual corridor map bounds.
 *
 * The map is infinite/chunked. The authored tile data starts
 * at Y = -16 and continues through Y = 47.
 *
 * The corridor itself is approximately centered around X = 10..25.
 */
export const CORRIDOR_MAP_BOUNDS = {
  minTileX: 0,
  maxTileX: 31,
  minTileY: -16,
  maxTileY: 47,
};

/**
 * Marker positions are authored in Tiled and should be used
 * by CorridorScene instead of hardcoded coordinates.
 *
 * Tiled uses pixel coordinates for object layers.
 */
export const CORRIDOR_MARKERS = {
  entrance: {
    name: 'corridor-enterance',
    type: 'RoomEntrance',
    x: 271.814278436795,
    y: 625.136452951022,
    width: 48.0314387599156,
    height: 46.2120660796157,
  },

  exit: {
    name: 'corridor-exit',
    type: '',
    x: 273.382111054393,
    y: -159.378367647893,
    width: 45.374624241393,
    height: 61.822925528898,
  },

  roomExit: {
    type: 'RoomExit',
    x: 272.083642051535,
    y: -159.298592244999,
    width: 47.748415246563,
    height: 62.5668889437721,
  },

  spawn: {
    name: 'corridor-starting-point',
    type: 'SpawnPoint',
    x: 256.36662696387,
    y: 592.138846350179,
    width: 75.4353128013158,
    height: 30.0606885599228,
  },
};

/**
 * Spawn point for convenience.
 *
 * Prefer reading the marker directly from the Tiled object layer
 * in CorridorScene.
 */
export const CORRIDOR_SPAWN = {
  x: 256.36662696387,
  y: 592.138846350179,
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