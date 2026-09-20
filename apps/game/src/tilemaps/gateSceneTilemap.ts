import { DECISION_TILESETS } from '../tilemaps/decisionRoomTilemap';

/**
 * Config + helpers for the Gate Scene's hand-authored Tiled map
 * (public/assets/map/gatescene/gatescene.json).
 *
 * Like the Decision Room map, this one references its tileset as an
 * EXTERNAL .tsx file ("FloorAndGround.tsx") which Phaser can't load. It's
 * the exact same FloorAndGround.png sliced at 16×16, firstgid 1 — i.e. the
 * same tileset already loaded for the Decision Room — so we reuse that
 * texture instead of loading the image again under a new key.
 */

export const GATE_TILEMAP_KEY = 'gate-scene-map';
export const GATE_TILEMAP_PATH = 'assets/map/gatescene/gatescene.json';

export const GATE_MAP_TILE_SIZE = 16;

/** The (already-loaded) 16×16 FloorAndGround tileset, reused from the Decision Room */
export const GATE_TILESET = DECISION_TILESETS[0];

/** Tile layers to render, bottom to top ("Tile Layer 3" is present but empty) */
export const GATE_TILE_LAYERS = ['floor', 'walls', 'Tile Layer 3'];

/**
 * Mutates a raw Tiled JSON map object in place, replacing the external
 * `{ firstgid, source }` tileset stub with a fully embedded tileset
 * definition Phaser's Tiled JSON parser can actually use.
 */
export function patchGateSceneTileset(rawMapJson: { tilesets: unknown[] }): void {
  rawMapJson.tilesets = [
    {
      columns: GATE_TILESET.columns,
      firstgid: GATE_TILESET.firstgid,
      image: GATE_TILESET.path.split('/').pop(),
      imageheight: GATE_TILESET.imageheight,
      imagewidth: GATE_TILESET.imagewidth,
      margin: 0,
      name: GATE_TILESET.name,
      spacing: 0,
      tilecount: GATE_TILESET.tilecount,
      tileheight: GATE_MAP_TILE_SIZE,
      tilewidth: GATE_MAP_TILE_SIZE,
    },
  ];
}
