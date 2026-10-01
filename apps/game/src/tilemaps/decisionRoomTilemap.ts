import type { TilesetDef } from './patchTilesets';

/**
 * Configuration + helpers for the hand-authored Decision Room Tiled map.
 *
 * Map:
 *   public/assets/map/decisionroom/decisionroom.json
 *
 * The map is an infinite/chunked Tiled map and references external .tsx
 * tilesets. Phaser does not resolve those external tilesets reliably in our
 * runtime, so the external references are replaced with embedded tileset
 * definitions before the map is loaded.
 */

export const DECISION_TILEMAP_KEY = 'decision-room-map';

export const DECISION_TILEMAP_PATH = 'assets/map/decisionroom/decisionroom.json';

export const DECISION_MAP_TILE_SIZE = 16;

/**
 * Tilesets referenced by decisionroom.json.
 *
 * firstgid values come directly from the Tiled map.
 */
export const DECISION_TILESETS: TilesetDef[] = [
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
 * Tiled layers that should be rendered.
 *
 * Order follows the layer order in decisionroom.json.
 */
export const DECISION_TILE_LAYERS = ['Tile Layer 1', 'Walls', 'furniture', 'computers'];

/**
 * Layer used for collision detection.
 */
export const DECISION_COLLIDABLE_LAYER = 'Walls';

/**
 * Actual playable tile bounds from the authored map.
 *
 * Tile Layer 1:
 *   X: -16 -> 59
 *   Y:   0 -> 38
 *
 * Walls extends one additional tile downward to Y = 39.
 */
export const DECISION_MAP_BOUNDS = {
  minTileX: -16,
  maxTileX: 59,
  minTileY: 0,
  maxTileY: 38,
};

/**
 * Spawn marker from the Tiled `markers` object layer.
 *
 * Tiled coordinates are pixel coordinates, not tile coordinates.
 *
 * starting-point:
 *   x = 377.72064874195
 *   y = 358.893263802101
 */
export const DECISION_SPAWN = {
  x: 377.72064874195,
  y: 358.893263802101,
};

/**
 * Door exit markers from the Tiled `markers` object layer.
 *
 * These are pixel coordinates from Tiled.
 */
export const DECISION_DOOR_EXITS = {
  A: {
    x: 159.216284987,
    y: -0.151823579,
    width: 33,
    height: 63,
  },
  B: {
    x: 271.031806615776,
    y: -0.117472434266318,
    width: 33,
    height: 63,
  },
  C: {
    x: 382.991094147583,
    y: 0.730703986429177,
    width: 33,
    height: 63,
  },
  D: {
    x: 495.798558100085,
    y: 0.730703986429177,
    width: 33,
    height: 63,
  },
};
