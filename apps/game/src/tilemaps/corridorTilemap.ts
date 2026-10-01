import type { DecisionTilesetDef } from './decisionRoomTilemap';

export const CORRIDOR_TILEMAP_KEY = 'corridor-map';

export const CORRIDOR_TILEMAP_PATH =
  'assets/map/corridor/corridor.json';

export const CORRIDOR_MAP_TILE_SIZE = 16;

/**
 * Tilesets referenced by corridor.json.
 *
 * The JSON contains external .tsx references. We replace those
 * references with embedded definitions before Phaser consumes
 * the tilemap.
 */
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
 * Tile layers rendered from bottom -> top.
 *
 * These names match the updated corridor.json.
 *
 * NOTE:
 * `markers` is intentionally NOT included here because it is
 * an object layer, not a tile layer.
 */
export const CORRIDOR_TILE_LAYERS = [
  'Floor',
  'Walls',
  'furniture',
  'computers',
] as const;

/**
 * Tile layer used for physics collision.
 */
export const CORRIDOR_COLLIDABLE_LAYER = 'Walls';

/**
 * Layer containing authored connection/spawn objects.
 */
export const CORRIDOR_MARKER_LAYER = 'markers';

/**
 * Bounds of the authored corridor map.
 *
 * IMPORTANT:
 * These bounds describe the actual useful map area, but we do NOT
 * modify/remove chunk data based on these bounds.
 *
 * The updated Tiled map is infinite/chunked and contains chunks
 * starting at negative coordinates.
 *
 * Current authored wall geometry is centered around the corridor
 * and spans approximately X = 0..31 and Y = -16..47.
 */
export const CORRIDOR_MAP_BOUNDS = {
  minTileX: 0,
  maxTileX: 47,
  minTileY: -32,
  maxTileY: 47,
} as const;

/**
 * Authored objects from the updated corridor.json `markers` layer.
 *
 * These values must remain in Tiled/world-pixel coordinates.
 * Do not convert them to tile coordinates here.
 */
export const CORRIDOR_MARKERS = {
  /**
   * Bottom entrance coming from the Decision Room.
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
   * Additional zero-size marker authored in Tiled.
   *
   * It is intentionally preserved because it belongs to the
   * map's authored marker data.
   */
  connectionPoint: {
    name: '',
    type: '',
    x: 551.676247076074,
    y: -288.069125181478,
    width: 0,
    height: 0,
  },

  /**
   * Visual / logical exit marker leading to the Option Room.
   */
  exit: {
    name: 'corridor-exit',
    type: '',
    x: 529.512132725017,
    y: -319.432345056258,
    width: 45.374624241393,
    height: 61.822925528898,
  },

  /**
   * Explicit RoomExit marker from Tiled.
   */
  roomExit: {
    name: '',
    type: 'RoomExit',
    x: 528.213663722159,
    y: -319.352569653364,
    width: 47.748415246563,
    height: 62.5668889437721,
  },

  /**
   * Player starting area inside the corridor.
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
 * Center of the authored corridor spawn marker.
 */
export const CORRIDOR_SPAWN = {
  x:
    CORRIDOR_MARKERS.spawn.x +
    CORRIDOR_MARKERS.spawn.width / 2,

  y:
    CORRIDOR_MARKERS.spawn.y +
    CORRIDOR_MARKERS.spawn.height / 2,
} as const;

/**
 * Center of the corridor entrance.
 */
export const CORRIDOR_ENTRANCE = {
  x:
    CORRIDOR_MARKERS.entrance.x +
    CORRIDOR_MARKERS.entrance.width / 2,

  y:
    CORRIDOR_MARKERS.entrance.y +
    CORRIDOR_MARKERS.entrance.height / 2,
} as const;

/**
 * Center of the corridor's RoomExit marker.
 */
export const CORRIDOR_EXIT = {
  x:
    CORRIDOR_MARKERS.roomExit.x +
    CORRIDOR_MARKERS.roomExit.width / 2,

  y:
    CORRIDOR_MARKERS.roomExit.y +
    CORRIDOR_MARKERS.roomExit.height / 2,
} as const;

/**
 * Marker bounding box type.
 *
 * Kept local to this file so consumers can use the exported
 * constants without depending on Tiled-specific types.
 */
export interface CorridorMarker {
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tiled infinite-map chunk.
 */
interface CorridorTileChunk {
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
}

/**
 * Minimal representation required for patching an imported
 * Tiled JSON map.
 */
interface CorridorTileLayer {
  type?: string;
  name?: string;
  chunks?: CorridorTileChunk[];
}

/**
 * Runtime shape accepted by patchCorridorTilesets().
 */
interface CorridorRawMapJson {
  tilesets: unknown[];
  layers?: CorridorTileLayer[];
}

/**
 * Replace Tiled's external .tsx tileset references with
 * embedded tileset definitions that Phaser can consume.
 *
 * IMPORTANT:
 *
 * This function intentionally does NOT modify tile-layer chunk
 * coordinates or tile data.
 *
 * The updated corridor JSON contains authored map geometry and
 * object markers. Removing tiles here can cause parts of the
 * corridor or its attached geometry to disappear when the map
 * is positioned as part of the continuous world.
 *
 * Object layers such as `markers` are also preserved untouched.
 */
export function patchCorridorTilesets(
  rawMapJson: CorridorRawMapJson,
): void {
  rawMapJson.tilesets = CORRIDOR_TILESETS.map(
    (tileset) => ({
      firstgid: tileset.firstgid,
      name: tileset.name,

      image: tileset.path
        .split('/')
        .pop(),

      imagewidth:
        tileset.imagewidth,

      imageheight:
        tileset.imageheight,

      columns:
        tileset.columns,

      tilecount:
        tileset.tilecount,

      tilewidth:
        CORRIDOR_MAP_TILE_SIZE,

      tileheight:
        CORRIDOR_MAP_TILE_SIZE,

      margin: 0,
      spacing: 0,
    }),
  );

  /*
   * Deliberately preserve:
   *
   * - tile layer chunks
   * - chunk x/y positions
   * - chunk widths/heights
   * - tile data
   * - object layers
   * - authored object coordinates
   *
   * The Phaser scene is responsible for positioning the entire
   * tilemap segment in world space.
   */

  void rawMapJson.layers;
}
