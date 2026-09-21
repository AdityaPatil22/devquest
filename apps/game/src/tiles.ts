/**
 * Tile indices for the seamless pattern tileset.
 * Spritesheet: 25×25, 16×16 tiles, no margin.
 * Frame = col + row * 25
 *
 * Adjust indices here if a tile doesn't look right.
 */

const PC = 25; // columns per row

export const PATTERNS = {
  // ─── Common Room (warm, welcoming) ───
  COMMON_FLOOR: 376, // warm light wood
  COMMON_FLOOR_ALT: 376, // slightly lighter wood
  COMMON_WALL: 377, // dark blue-gray stone
  COMMON_WALL_ALT: 377, // dark blue-gray stone variant

  // ─── Gate (dark, mysterious) ───
  GATE_FLOOR: 58, // very dark blue stone
  GATE_FLOOR_ALT: 58, // very dark blue stone variant
  GATE_WALL: 377, // dark stone
  GATE_WALL_ALT: 377, // darker stone

  // ─── Decision Room (neutral, focused) ───
  DECISION_FLOOR: 107, // brown stone
  DECISION_FLOOR_ALT: 108, // brown stone variant
  DECISION_WALL: 36, // blue-gray brick
  DECISION_WALL_ALT: 9, // dark stone brick

  // ─── Trophy Room (celebratory, grand) ───
  TROPHY_FLOOR: 101, // golden sandy stone
  TROPHY_FLOOR_ALT: 102, // golden sandy stone variant
  TROPHY_WALL: 93, // dark stone
  TROPHY_WALL_ALT: 81, // dark stone variant

  // ─── Doors (dark wood-like pattern for door frames) ───
  DOOR: 599, // dark brown
  DOOR_ALT: 271, // dark brown variant
} as const;

export const PATTERNS_KEY = 'pattern-tiles';
export const PATTERNS_PATH = 'assets/tilesets/16x16px/16x16_SpriteSheet.png';
export const PATTERNS_CONFIG = {
  frameWidth: 16,
  frameHeight: 16,
  margin: 0,
  spacing: 0,
};

/** Display scale for all tiles (16px × 2 = 32px on screen) */
export const TILE_SCALE = 3;

/** Effective tile size on screen after scaling */
export const DISPLAY_TILE = 16 * TILE_SCALE; // 32px
