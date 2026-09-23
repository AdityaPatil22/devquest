/**
 * Config for the four random option-room maps
 * (public/assets/map/randomrooms/room-N.json).
 *
 * All rooms share the same tilesets and layer names
 * as the Decision Room, so we reuse those definitions.
 */

import {
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  patchDecisionRoomTilesets,
} from './decisionRoomTilemap';

// Re-export for callers that only know about option rooms.
export {
  DECISION_TILESETS as OPTION_ROOM_TILESETS,
  DECISION_MAP_TILE_SIZE as OPTION_ROOM_TILE_SIZE,
  patchDecisionRoomTilesets as patchOptionRoomTilesets,
};

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

/** Layer names, bottom → top (same ordering as decision room). */
export const OPTION_ROOM_TILE_LAYERS = [
  'Tile Layer 1',
  'Walls',
  'furniture',
  'computers',
];

export const OPTION_ROOM_COLLIDABLE_LAYER = 'Walls';

/** Tile extent of every option room (all four rooms are identical). */
export const OPTION_ROOM_BOUNDS = {
  minTileX: 0,
  maxTileX: 69,
  minTileY: 0,
  maxTileY: 29,
};

/** Width in pixels (70 tiles × 16 px). */
export const OPTION_ROOM_WIDTH_PX =
  (OPTION_ROOM_BOUNDS.maxTileX - OPTION_ROOM_BOUNDS.minTileX + 1) *
  DECISION_MAP_TILE_SIZE;

/** Height in pixels (30 tiles × 16 px). */
export const OPTION_ROOM_HEIGHT_PX =
  (OPTION_ROOM_BOUNDS.maxTileY - OPTION_ROOM_BOUNDS.minTileY + 1) *
  DECISION_MAP_TILE_SIZE;
