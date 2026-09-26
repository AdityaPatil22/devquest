/**
 * Config for the four random option-room maps
 * (public/assets/map/randomrooms/room-N.json).
 *
 * The option-room maps are infinite/chunked Tiled maps.
 *
 * Tiled structure:
 *
 *   Tile Layer 1
 *   Walls
 *   markers
 *
 * Important positions are authored in Tiled using marker objects.
 * Phaser uses those marker coordinates directly instead of
 * relying on hardcoded tile rows/columns.
 */

import {
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  patchDecisionRoomTilesets,
} from './decisionRoomTilemap';

export const OPTION_ROOM_TILESETS = DECISION_TILESETS;
export const OPTION_ROOM_TILE_SIZE = DECISION_MAP_TILE_SIZE;

export const OPTION_ROOM_TILEMAP_KEYS = [
  'option-room-1',
  'option-room-2',
  'option-room-3',
  'option-room-4',
] as const;

export type OptionRoomKey = (typeof OPTION_ROOM_TILEMAP_KEYS)[number];

export const OPTION_ROOM_TILEMAP_PATHS: Record<OptionRoomKey, string> = {
  'option-room-1': 'assets/map/randomrooms/room-1.json',
  'option-room-2': 'assets/map/randomrooms/room-2.json',
  'option-room-3': 'assets/map/randomrooms/room-3.json',
  'option-room-4': 'assets/map/randomrooms/room-4.json',
};

/**
 * Tile layers rendered from bottom -> top.
 *
 * The current Tiled maps use:
 *
 *   Tile Layer 1
 *   Walls
 */
export const OPTION_ROOM_TILE_LAYERS = [
  'Tile Layer 1',
  'Walls',
];

/**
 * Layer containing blocking wall tiles.
 */
export const OPTION_ROOM_COLLIDABLE_LAYER = 'Walls';

/**
 * Actual tile bounds of the authored room geometry.
 *
 * The current map layers cover:
 *
 *   X: 0 -> 63
 *   Y: 0 -> 47
 *
 * These are map/tile coordinates, not marker coordinates.
 */
export const OPTION_ROOM_BOUNDS = {
  minTileX: 0,
  maxTileX: 63,
  minTileY: 0,
  maxTileY: 47,
};

/**
 * Width of the playable room in pixels.
 */
export const OPTION_ROOM_WIDTH_PX =
  (OPTION_ROOM_BOUNDS.maxTileX - OPTION_ROOM_BOUNDS.minTileX + 1) *
  OPTION_ROOM_TILE_SIZE;

/**
 * Height of the playable room in pixels.
 */
export const OPTION_ROOM_HEIGHT_PX =
  (OPTION_ROOM_BOUNDS.maxTileY - OPTION_ROOM_BOUNDS.minTileY + 1) *
  OPTION_ROOM_TILE_SIZE;

/**
 * Marker coordinates authored in Tiled.
 *
 * These are pixel coordinates in the option-room map.
 */
export const OPTION_ROOM_MARKERS = {
  corridorEntrance: {
    x: 353.548906480612,
    y: 465.584328458339,
    width: 45.6192137394338,
    height: 44.2774721588622,
  },

  startingPoint: {
    x: 333.422782772038,
    y: 442.774721588622,
    width: 88.5549443177244,
    height: 20.1261237085737,
  },

  doorExits: {
    a: {
      x: 208.12685827552,
      y: 1.16597679706174,
      width: 32.6473503177287,
      height: 62.379758642803,
    },

    b: {
      x: 303.736955634583,
      y: 1.16597679706174,
      width: 32.6473503177286,
      height: 61.2137818457413,
    },

    c: {
      x: 399.930041392176,
      y: 1.16597679706174,
      width: 33.2303387162596,
      height: 61.7967702442721,
    },

    d: {
      x: 495.540138751239,
      y: 1.74896519559261,
      width: 33.8133271147904,
      height: 61.2137818457413,
    },
  },

  doorInteractions: {
    a: {
      x: 192.386171515187,
      y: 65.2947006354574,
      width: 63.5457354398648,
      height: 14.5747099632717,
    },

    b: {
      x: 288.57925727278,
      y: 64.1287238383956,
      width: 62.9627470413338,
      height: 15.7406867603335,
    },

    c: {
      x: 384.772343030374,
      y: 64.1287238383956,
      width: 63.5457354398648,
      height: 15.7406867603335,
    },

    d: {
      x: 480.382440389436,
      y: 63.5457354398647,
      width: 63.5457354398648,
      height: 16.3236751588643,
    },
  },
} as const;

/**
 * Convenience spawn marker.
 */
export const OPTION_ROOM_SPAWN =
  OPTION_ROOM_MARKERS.startingPoint;

/**
 * Convenience corridor entrance marker.
 */
export const OPTION_ROOM_ENTRANCE =
  OPTION_ROOM_MARKERS.corridorEntrance;

/**
 * Door exit markers.
 */
export const OPTION_ROOM_DOOR_EXITS =
  OPTION_ROOM_MARKERS.doorExits;

/**
 * Door interaction markers.
 */
export const OPTION_ROOM_DOOR_INTERACTIONS =
  OPTION_ROOM_MARKERS.doorInteractions;

/**
 * Replace Tiled's external tileset references with
 * embedded tileset definitions that Phaser can consume.
 *
 * The option-room maps are infinite/chunked maps, so
 * preserve the authored chunk coordinates and tile data.
 */
export function patchOptionRoomTilesets(rawMapJson: {
  tilesets: unknown[];
}): void {
  patchDecisionRoomTilesets(rawMapJson);
}