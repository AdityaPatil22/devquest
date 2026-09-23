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

export const CORRIDOR_MAP_BOUNDS = {
  minTileX: 0,
  maxTileX: 47,
  minTileY: 0,
  maxTileY: 31,
};

export function patchCorridorTilesets(
  rawMapJson: { tilesets: unknown[] },
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
}