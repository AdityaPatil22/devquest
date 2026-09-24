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

export {
  DECISION_TILESETS as OPTION_ROOM_TILESETS,
  DECISION_MAP_TILE_SIZE as OPTION_ROOM_TILE_SIZE,
};

export const OPTION_ROOM_TILEMAP_KEYS = [
  'option-room-1',
  'option-room-2',
  'option-room-3',
  'option-room-4',
] as const;

export type OptionRoomKey =
  (typeof OPTION_ROOM_TILEMAP_KEYS)[number];

export const OPTION_ROOM_TILEMAP_PATHS:
  Record<OptionRoomKey, string> = {
  'option-room-1':
    'assets/map/randomrooms/room-1.json',
  'option-room-2':
    'assets/map/randomrooms/room-2.json',
  'option-room-3':
    'assets/map/randomrooms/room-3.json',
  'option-room-4':
    'assets/map/randomrooms/room-4.json',
};

export const OPTION_ROOM_TILE_LAYERS = [
  'Tile Layer 1',
  'Walls',
  'furniture',
  'computers',
];

export const OPTION_ROOM_COLLIDABLE_LAYER =
  'Walls';

export const OPTION_ROOM_BOUNDS = {
  minTileX: 1,
  maxTileX: 48,
  minTileY: 0,
  maxTileY: 29,
};

export const OPTION_ROOM_WIDTH_PX =
  (
    OPTION_ROOM_BOUNDS.maxTileX -
    OPTION_ROOM_BOUNDS.minTileX +
    1
  ) *
  DECISION_MAP_TILE_SIZE;

export const OPTION_ROOM_HEIGHT_PX =
  (
    OPTION_ROOM_BOUNDS.maxTileY -
    OPTION_ROOM_BOUNDS.minTileY +
    1
  ) *
  DECISION_MAP_TILE_SIZE;

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

export function patchOptionRoomTilesets(
  rawMapJson: {
    tilesets: unknown[];
    layers?: OptionRoomTileLayer[];
  },
): void {
  patchDecisionRoomTilesets(
    rawMapJson,
  );

  for (
    const layer of
      rawMapJson.layers ?? []
  ) {
    if (
      layer.type !== 'tilelayer' ||
      !layer.chunks
    ) {
      continue;
    }

    for (
      const chunk of
        layer.chunks
    ) {
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
            chunk.x +
            col;

          const worldY =
            chunk.y +
            row;

          if (
            worldX <
              OPTION_ROOM_BOUNDS.minTileX ||
            worldX >
              OPTION_ROOM_BOUNDS.maxTileX ||
            worldY <
              OPTION_ROOM_BOUNDS.minTileY ||
            worldY >
              OPTION_ROOM_BOUNDS.maxTileY
          ) {
            chunk.data[
              row * chunk.width +
              col
            ] = 0;
          }
        }
      }
    }
  }
}
