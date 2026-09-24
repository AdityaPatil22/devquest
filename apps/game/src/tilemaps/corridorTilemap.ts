import type { DecisionTilesetDef } from './decisionRoomTilemap';

export const CORRIDOR_TILEMAP_KEY = 'corridor-map';

export const CORRIDOR_TILEMAP_PATH =
  'assets/map/corridor/corridor.json';

export const CORRIDOR_MAP_TILE_SIZE = 16;

export const CORRIDOR_TILESETS: DecisionTilesetDef[] = [
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

export const CORRIDOR_TILE_LAYERS = [
  'Tile Layer 1',
  'Walls',
  'furniture',
  'computers',
];

export const CORRIDOR_COLLIDABLE_LAYER = 'Walls';

/**
 * Bounds of the updated corridor map.
 *
 * The updated Tiled map extends vertically from y = -10
 * through y = 39, with the wall structure spanning roughly
 * x = 10 through x = 26.
 *
 * Keep the bounds slightly wider than the wall geometry so
 * the player can move through the complete corridor.
 */
export const CORRIDOR_MAP_BOUNDS = {
  minTileX: 10,
  maxTileX: 26,
  minTileY: -10,
  maxTileY: 39,
};

interface CorridorTileChunk {
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
}

interface CorridorTileLayer {
  type?: string;
  name?: string;
  chunks?: CorridorTileChunk[];
}

export function patchCorridorTilesets(
  rawMapJson: {
    tilesets: unknown[];
    layers?: CorridorTileLayer[];
  },
): void {
  rawMapJson.tilesets = CORRIDOR_TILESETS.map(
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
      tileheight: CORRIDOR_MAP_TILE_SIZE,
      tilewidth: CORRIDOR_MAP_TILE_SIZE,
    }),
  );

  for (const layer of rawMapJson.layers ?? []) {
    if (
      layer.type !== 'tilelayer' ||
      !layer.chunks
    ) {
      continue;
    }

    for (const chunk of layer.chunks) {
      for (let row = 0; row < chunk.height; row++) {
        for (let col = 0; col < chunk.width; col++) {
          const worldX = chunk.x + col;
          const worldY = chunk.y + row;

          if (
            worldX < CORRIDOR_MAP_BOUNDS.minTileX ||
            worldX > CORRIDOR_MAP_BOUNDS.maxTileX ||
            worldY < CORRIDOR_MAP_BOUNDS.minTileY ||
            worldY > CORRIDOR_MAP_BOUNDS.maxTileY
          ) {
            chunk.data[
              row * chunk.width + col
            ] = 0;
          }
        }
      }
    }
  }
}