/**
 * Config + helpers for the Decision Room's hand-authored Tiled map
 * (public/assets/map/decisionroom/decision-room.json).
 *
 * That map references its tilesets as EXTERNAL .tsx files:
 *   "map/FloorAndGround.tsx"
 *   "map/Modern_Office_Black_Shadow.tsx"
 * Neither .tsx file is included in the repo, and Phaser's Tiled JSON parser
 * doesn't support external tileset references at all (it just warns
 * "External tilesets unsupported" and skips them).
 *
 * However, both tilesets are actually the exact same source PNGs already
 * used by the Common Room map — just re-sliced at 16×16 instead of 32×32
 * tiles:
 *   - FloorAndGround.png (2048×1280)             -> 128 cols × 80 rows  = 10240 tiles
 *   - Modern_Office_Black_Shadow.png (512×1696)  ->  32 cols × 106 rows =  3392 tiles
 * The second tileset's firstgid (10241 = 10240 + 1) confirms this exactly.
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
  /** Phaser texture key to load the (shared) image under, at 16×16 frames */
  key: string;
  /** Path relative to /public */
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
];

/** Tile layers to render, bottom to top */
export const DECISION_TILE_LAYERS = ['Tile Layer 1', 'Walls', 'furniture', 'computers'];

/** The one layer whose tiles should block the player */
export const DECISION_COLLIDABLE_LAYER = 'Walls';

/** Player spawn point, in tile coordinates — a verified open walkable tile */
export const DECISION_SPAWN_TILE = { x: 25, y: 16 };

/** Row (in tile coordinates) doors are placed along, near the top of the room */
export const DECISION_DOOR_ROW_TILE_Y = 5;

/**
 * Mutates a raw Tiled JSON map object in place, replacing the two external
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
