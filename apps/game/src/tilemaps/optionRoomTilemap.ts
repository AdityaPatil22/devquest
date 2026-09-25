/**
 * Config for the four random option-room maps
 * (public/assets/map/randomrooms/room-N.json).
 *
 * The option-room maps are infinite/chunked Tiled maps.
 *
 * Current room structure:
 *
 *   floor
 *   Walls
 *
 * The room is kept as an infinite map so the chunk coordinates
 * authored in Tiled remain intact.
 */

import {
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  patchDecisionRoomTilesets,
} from './decisionRoomTilemap';

export const OPTION_ROOM_TILESETS = DECISION_TILESETS;
export const OPTION_ROOM_TILE_SIZE =
  DECISION_MAP_TILE_SIZE;

export const OPTION_ROOM_TILEMAP_KEYS = [
  'option-room-1',
  'option-room-2',
  'option-room-3',
  'option-room-4',
] as const;

export type OptionRoomKey =
  (typeof OPTION_ROOM_TILEMAP_KEYS)[number];

export const OPTION_ROOM_TILEMAP_PATHS: Record<
  OptionRoomKey,
  string
> = {
  'option-room-1':
    'assets/map/randomrooms/room.json',

  'option-room-2':
    'assets/map/randomrooms/room-2.json',

  'option-room-3':
    'assets/map/randomrooms/room-3.json',

  'option-room-4':
    'assets/map/randomrooms/room-4.json',
};

/**
 * Tile layers rendered from bottom -> top.
 *
 * The new infinite maps use:
 *
 *   floor
 *   Walls
 */
export const OPTION_ROOM_TILE_LAYERS = [
  'floor',
  'Walls',
];

/**
 * Layer containing blocking wall tiles.
 */
export const OPTION_ROOM_COLLIDABLE_LAYER = 'Walls';

/**
 * Playable room bounds in tile coordinates.
 *
 * These are the bounds of the actual room geometry,
 * not the full infinite map.
 *
 * Keep these values aligned with the wall perimeter
 * authored in Tiled.
 */

/**
 * Row where decision doors are placed inside an option room.
 *
 * IMPORTANT:
 * This must match the actual door/wall layout in the
 * Tiled option-room maps.
 */
export const OPTION_ROOM_DOOR_ROW_TILE_Y = 15;

/**
 * Horizontal tile range available for decision doors
 * inside an option room.
 *
 * These are LOCAL TILED coordinates.
 */
export const OPTION_ROOM_DOOR_ROW_X_RANGE = {
  minTileX: 14,
  maxTileX: 45,
};

export const OPTION_ROOM_BOUNDS = {
  minTileX: 10,
  maxTileX: 49,
  minTileY: 10,
  maxTileY: 39,
};

/**
 * Width of the playable room in pixels.
 */
export const OPTION_ROOM_WIDTH_PX =
  (OPTION_ROOM_BOUNDS.maxTileX -
    OPTION_ROOM_BOUNDS.minTileX +
    1) *
  OPTION_ROOM_TILE_SIZE;


/**
 * Height of the playable room in pixels.
 */
export const OPTION_ROOM_HEIGHT_PX =
  (OPTION_ROOM_BOUNDS.maxTileY -
    OPTION_ROOM_BOUNDS.minTileY +
    1) *
  OPTION_ROOM_TILE_SIZE;

/**
 * Corridor entrance in the option room.
 *
 * Three tiles wide.
 */
export const OPTION_ROOM_ENTRANCE_MIN_TILE_X = 41;
export const OPTION_ROOM_ENTRANCE_MAX_TILE_X = 44;
export const OPTION_ROOM_ENTRANCE_TILE_Y = 39;

interface OptionRoomTileChunk {
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
}

interface OptionRoomTileLayer {
  type?: string;
  name?: string;
  chunks?: OptionRoomTileChunk[];
}

/**
 * Replace Tiled's external tileset references with
 * embedded tileset definitions that Phaser can consume.
 *
 * The map is infinite/chunked, so we remove only the
 * tile data outside the actual playable room bounds.
 *
 * This preserves the Tiled chunk layout while preventing
 * decorative/outside tiles from affecting the rendered room.
 */
export function patchOptionRoomTilesets(
  rawMapJson: {
    tilesets: unknown[];
    layers?: OptionRoomTileLayer[];
  },
): void {
  patchDecisionRoomTilesets(rawMapJson);

  for (const layer of rawMapJson.layers ?? []) {
    if (
      layer.type !== 'tilelayer' ||
      !layer.chunks
    ) {
      continue;
    }

    for (const chunk of layer.chunks) {
      for (
        let row = 0;
        row < chunk.height;
        row++
      ) {
        for (
          let col = 0;
          col < chunk.width;
          col++
        ) {
          const worldX =
            chunk.x + col;

          const worldY =
            chunk.y + row;

          const outsideBounds =
            worldX <
              OPTION_ROOM_BOUNDS.minTileX ||
            worldX >
              OPTION_ROOM_BOUNDS.maxTileX ||
            worldY <
              OPTION_ROOM_BOUNDS.minTileY ||
            worldY >
              OPTION_ROOM_BOUNDS.maxTileY;

          if (outsideBounds) {
            chunk.data[
              row * chunk.width + col
            ] = 0;
          }
        }
      }
    }
  }
}