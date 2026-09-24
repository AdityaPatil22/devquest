/**
 * Config + helpers for the Decision Room's hand-authored Tiled map
 * (public/assets/map/decisionroom/decisionroom.json).
 *
 * The map is an "infinite" (chunked) Tiled map and uses external .tsx
 * tilesets. Phaser does not resolve these external tilesets correctly,
 * so we inject embedded tileset definitions before creating the map.
 */

export const DECISION_TILEMAP_KEY = 'decision-room-map';

export const DECISION_TILEMAP_PATH =
  'assets/map/decisionroom/decisionroom.json';

/**
 * Tiled map tile size.
 */
export const DECISION_MAP_TILE_SIZE = 16;

export interface DecisionTilesetDef {
  /** Name used by Phaser for this tileset */
  name: string;

  /** Phaser texture key containing 16x16 frames */
  key: string;

  /** PNG path relative to /public */
  path: string;

  /** Tiled firstgid */
  firstgid: number;

  columns: number;
  imagewidth: number;
  imageheight: number;
  tilecount: number;
}

/**
 * Tilesets used by the Decision Room map.
 */
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
    /**
     * FloorAndGround is referenced a second time by Tiled.
     * It uses the same PNG/texture but requires a separate
     * tileset definition because it has a different firstgid.
     */
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
 * Tile layers to render, bottom -> top.
 */
export const DECISION_TILE_LAYERS = [
  'Tile Layer 1',
  'Walls',
  'furniture',
  'computers',
];

/**
 * Layer containing blocking wall tiles.
 */
export const DECISION_COLLIDABLE_LAYER = 'Walls';

/**
 * Actual playable bounds of the Decision Room.
 *
 * The updated Tiled map contains floor content across:
 *
 *   X: -16 -> 59
 *   Y:   0 -> 38
 *
 * The Walls layer extends one additional tile downward to Y = 39.
 */
export const DECISION_MAP_BOUNDS = {
  minTileX: -16,
  maxTileX: 59,
  minTileY: 0,
  maxTileY: 38,
};

/**
 * Player spawn position.
 *
 * Keep this inside the playable floor area.
 */
export const DECISION_SPAWN_TILE = {
  x: 30,
  y: 16,
};

/**
 * Row where the decision doors are placed.
 */
export const DECISION_DOOR_ROW_TILE_Y = 5;

/**
 * Horizontal area available for the decision doors.
 */
export const DECISION_DOOR_ROW_X_RANGE = {
  minTileX: 4,
  maxTileX: 45,
};

/**
 * Replace Tiled's external tileset references with embedded
 * tileset definitions that Phaser can consume.
 */
export function patchDecisionRoomTilesets(
  rawMapJson: {
    tilesets: unknown[];
  },
): void {
  rawMapJson.tilesets = DECISION_TILESETS.map(
    (tileset) => ({
      columns: tileset.columns,
      firstgid: tileset.firstgid,

      image: tileset.path.split('/').pop(),

      imageheight: tileset.imageheight,
      imagewidth: tileset.imagewidth,

      margin: 0,
      name: tileset.name,
      spacing: 0,

      tilecount: tileset.tilecount,

      tileheight: DECISION_MAP_TILE_SIZE,
      tilewidth: DECISION_MAP_TILE_SIZE,
    }),
  );
}

