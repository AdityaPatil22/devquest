/**
 * Config + helpers for the Trophy Room's hand-authored Tiled map.
 *
 * The Trophy Room map uses the same 16x16 source PNGs as the Decision Room.
 * Phaser does not resolve external .tsx tilesets reliably, so we embed the
 * tileset definitions before creating the Tilemap.
 */

export const TROPHY_TILEMAP_KEY = 'trophy-room-map';

export const TROPHY_TILEMAP_PATH = 'assets/map/trophyroom/trophyroom.json';

export const TROPHY_MAP_TILE_SIZE = 16;

export interface TrophyTilesetDef {
  name: string;
  key: string;
  path: string;
  firstgid: number;
  columns: number;
  imagewidth: number;
  imageheight: number;
  tilecount: number;
}

export const TROPHY_TILESETS: TrophyTilesetDef[] = [
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

export const TROPHY_TILE_LAYERS = ['Tile Layer 1', 'Walls', 'furniture', 'computers'];

export const TROPHY_COLLIDABLE_LAYER = 'Walls';

/**
 * Update these after the Trophy Room map has been created.
 */
export const TROPHY_MAP_BOUNDS = {
  minTileX: -16,
  maxTileX: 59,
  minTileY: 0,
  maxTileY: 38,
};

export const TROPHY_SPAWN_TILE = {
  x: 16,
  y: 16,
};

export function patchTrophyRoomTilesets(rawMapJson: { tilesets: unknown[] }): void {
  rawMapJson.tilesets = TROPHY_TILESETS.map((t) => ({
    columns: t.columns,
    firstgid: t.firstgid,
    image: t.path.split('/').pop(),
    imageheight: t.imageheight,
    imagewidth: t.imagewidth,
    margin: 0,
    name: t.name,
    spacing: 0,
    tilecount: t.tilecount,
    tileheight: TROPHY_MAP_TILE_SIZE,
    tilewidth: TROPHY_MAP_TILE_SIZE,
  }));
}
