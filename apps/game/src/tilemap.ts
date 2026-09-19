/**
 * Config for the hand-built Tiled office map used by the Common Room.
 *
 * The map (public/assets/map/map.json) was authored in Tiled and references
 * 8 separate tileset images. Each tileset's `name` below MUST match the
 * "name" field of the corresponding tileset entry inside map.json — Phaser
 * uses that name to resolve which loaded image backs each tile GID.
 */

export const TILEMAP_KEY = 'office-map';
export const TILEMAP_PATH = 'assets/map/map.json';

/** Tiled map + tile grid size, in pixels (matches map.json tilewidth/height) */
export const MAP_TILE_SIZE = 32;

export interface TilesetDef {
  /** Must match the tileset "name" property inside map.json */
  name: string;
  /** Phaser texture key to load the image under */
  key: string;
  /** Path relative to /public */
  path: string;
  /** Per-tile frame size for this tileset (must match map.json's tilewidth/tileheight for this tileset) */
  frameWidth: number;
  frameHeight: number;
}

/**
 * Loaded as spritesheets (not plain images) so Phaser registers one numbered
 * frame per tile. `createFromObjects` needs those real per-tile frames to
 * pick the correct sub-region — without them every furniture object rendered
 * as the whole squished spritesheet instead of a single tile.
 */
export const MAP_TILESETS: TilesetDef[] = [
  { name: 'FloorAndGround', key: 'tileset-floor-and-ground', path: 'assets/map/FloorAndGround.png', frameWidth: 32, frameHeight: 32 },
  { name: 'chair', key: 'tileset-chair', path: 'assets/items/chair.png', frameWidth: 32, frameHeight: 64 },
  { name: 'Modern_Office_Black_Shadow', key: 'tileset-modern-office', path: 'assets/items/Modern_Office_Black_Shadow.png', frameWidth: 32, frameHeight: 32 },
  { name: 'Generic', key: 'tileset-generic', path: 'assets/items/Generic.png', frameWidth: 32, frameHeight: 32 },
  { name: 'computer', key: 'tileset-computer', path: 'assets/items/computer.png', frameWidth: 96, frameHeight: 64 },
  { name: 'whiteboard', key: 'tileset-whiteboard', path: 'assets/items/whiteboard.png', frameWidth: 64, frameHeight: 64 },
  { name: 'Basement', key: 'tileset-basement', path: 'assets/items/Basement.png', frameWidth: 32, frameHeight: 32 },
  { name: 'vendingmachine', key: 'tileset-vendingmachine', path: 'assets/items/vendingmachine.png', frameWidth: 48, frameHeight: 72 },
];

/** Object layers (from map.json) whose tile objects should block player movement */
export const COLLIDABLE_OBJECT_LAYERS = ['Wall', 'ObjectsOnCollide', 'GenericObjectsOnCollide'];

/** Object layers rendered as pure decoration (furniture etc.) — no collision */
export const DECOR_OBJECT_LAYERS = [
  'Chair',
  'Objects',
  'GenericObjects',
  'Computer',
  'Whiteboard',
  'Basement',
  'VendingMachine',
];

/** Player spawn point, in tile coordinates — a verified open walkable tile */
export const SPAWN_TILE = { x: 13, y: 13 };

/** Gate trigger point, in tile coordinates — a verified open walkable tile */
export const GATE_TILE = { x: 25, y: 4 };
