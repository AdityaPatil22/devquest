/**
 * Config + helpers for the Decision Room's hand-authored Tiled map
 * (public/assets/map/decisionroom/decision-room.json).
 *
 * That map is an "infinite" (chunked) Tiled map and references its
 * tilesets as EXTERNAL .tsx files:
 *   "map/FloorAndGround.tsx"          (firstgid 1)
 *   "map/Modern_Office_Black_Shadow.tsx" (firstgid 10241)
 *   "FloorAndGround.tsx"              (firstgid 13633 — same PNG again)
 *   "Generic.tsx"                     (firstgid 23873)
 *   "Basement.tsx"                    (firstgid 28865)
 * None of the .tsx files are included in the repo, and Phaser's Tiled JSON
 * parser doesn't support external tileset references at all (it just warns
 * "External tilesets unsupported" and skips them).
 *
 * However, every one of these is actually a source PNG already used by the
 * Common Room map — just re-sliced at 16×16 instead of 32×32 tiles:
 *   - FloorAndGround.png (2048×1280)            -> 128 cols × 80 rows  = 10240 tiles
 *   - Modern_Office_Black_Shadow.png (512×1696) ->  32 cols × 106 rows =  3392 tiles
 *   - Generic.png (512×2496)                    ->  32 cols × 156 rows =  4992 tiles
 *   - Basement.png (512×1600)                   ->  32 cols × 100 rows =  3200 tiles
 * Each successive firstgid (10241, 13633, 23873, 28865) is exactly the sum
 * of the tile counts before it, confirming this.
 *
 * Since Phaser can't resolve the external references itself, we patch the
 * cached map JSON at runtime (`patchDecisionRoomTilesets`) to inject fully
 * "embedded" tileset definitions before creating the Tilemap from it.
 */

export const DECISION_TILEMAP_KEY = 'decision-room-map';
export const DECISION_TILEMAP_PATH = 'assets/map/decisionroom/decision-room.json';

/** This map's real tile grid size, in pixels */
export const DECISION_MAP_TILE_SIZE = 16;

export interface DecisionTilesetDef {
  /** Name we assign this tileset — used to match it up in Phaser */
  name: string;
  /** Phaser texture key backing this tileset (16×16 frames) */
  key: string;
  /** Path relative to /public — only used to derive the embedded "image" filename */
  path: string;
  firstgid: number;
  columns: number;
  imagewidth: number;
  imageheight: number;
  tilecount: number;
}

export const DECISION_TILESETS: DecisionTilesetDef[] = [
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
    // Same FloorAndGround.png as above, referenced a second time under a
    // different firstgid — needs its own Tileset entry (same texture key
    // is fine, Phaser just needs a distinct tileset "name" to key off of).
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

/** Tile layers to render, bottom to top */
export const DECISION_TILE_LAYERS = ['Tile Layer 1', 'Walls', 'furniture', 'computers'];

/** The one layer whose tiles should block the player */
export const DECISION_COLLIDABLE_LAYER = 'Walls';

/**
 * This is an "infinite" Tiled map — tiles are stored in chunks and can
 * have negative coordinates, so there's no guarantee content starts at
 * world tile (0, 0). These bounds were measured directly from the current
 * map data's "Tile Layer 1" (floor) chunks and mark the actual playable
 * area, in tile coordinates (inclusive).
 */
export const DECISION_MAP_BOUNDS = {
  minTileX: -16,
  maxTileX: 59,
  minTileY: 0,
  maxTileY: 38,
};

/** Player spawn point, in tile coordinates — a verified open walkable tile */
export const DECISION_SPAWN_TILE = { x: 30, y: 16 };

/** Row (in tile coordinates) doors are placed along, near the top of the main room */
export const DECISION_DOOR_ROW_TILE_Y = 5;

/** Usable open horizontal span (in tile coordinates, inclusive) along the door row */
export const DECISION_DOOR_ROW_X_RANGE = { minTileX: 4, maxTileX: 45 };

/**
 * Mutates a raw Tiled JSON map object in place, replacing the external
 * `{ firstgid, source }` tileset stubs with fully embedded tileset
 * definitions that Phaser's Tiled JSON parser can actually use.
 */
export function patchDecisionRoomTilesets(rawMapJson: {
  tilesets: unknown[];
}): void {
  rawMapJson.tilesets = DECISION_TILESETS.map((t) => ({
    columns: t.columns,
    firstgid: t.firstgid,
    image: t.path.split('/').pop(),
    imageheight: t.imageheight,
    imagewidth: t.imagewidth,
    margin: 0,
    name: t.name,
    spacing: 0,
    tilecount: t.tilecount,
    tileheight: DECISION_MAP_TILE_SIZE,
    tilewidth: DECISION_MAP_TILE_SIZE,
  }));
}
