/**
 * Shared Tiled-map loading for the scenes that render embedded tilesets
 * (Grilling Scene segments and the Trophy Room).
 *
 * The Common Room is deliberately not a client of this module — it loads its
 * tilesets as spritesheets so `createFromObjects` can address per-tile frames.
 */

import Phaser from 'phaser';

import { patchTilesets, type TilesetDef } from '../../tilemaps/patchTilesets';

export type CreatedTilemapLayer = NonNullable<ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>>;

/**
 * Tiled exports reference external `.tsx` tilesets that Phaser cannot resolve,
 * so the cached raw JSON is patched with embedded definitions before the
 * tilemap is built.
 *
 * `patch` is only overridden by maps whose tilesets need a bespoke shape.
 */
export function loadTilemap(
  scene: Phaser.Scene,
  tilemapKey: string,
  tilesetDefs: readonly TilesetDef[],
  tileSize: number,
  patch: (raw: { tilesets: unknown[] }) => void = (raw) =>
    patchTilesets(raw, tilesetDefs, tileSize),
): { map: Phaser.Tilemaps.Tilemap; tilesets: Phaser.Tilemaps.Tileset[] } {
  const cached = scene.cache.tilemap.get(tilemapKey);

  if (cached?.data) {
    patch(cached.data);
  }

  const map = scene.make.tilemap({ key: tilemapKey });

  const tilesets = tilesetDefs
    .map((tileset) => map.addTilesetImage(tileset.name, tileset.key))
    .filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

  return { map, tilesets };
}

export interface AddTileLayersOptions {
  layerNames: readonly string[];
  /** Layer whose non-empty tiles block the player. */
  collidableLayer: string;
  /** Base depth; layers stack upwards from here in `layerNames` order. */
  depthOffset?: number;
  create: (layerName: string) => CreatedTilemapLayer | null;
  /**
   * Applied before the depth is set. Each authored map has its own chunk
   * origin, so placement stays with the caller.
   */
  position?: (layer: CreatedTilemapLayer) => void;
  /** When given, a collider is wired between it and the collidable layer. */
  collideWith?: Phaser.Physics.Arcade.Sprite;
}

/**
 * Render a map's tile layers in order and return them alongside any colliders
 * created, so the caller can destroy both when the map goes away.
 */
export function addTileLayers(
  scene: Phaser.Scene,
  options: AddTileLayersOptions,
): { layers: CreatedTilemapLayer[]; colliders: Phaser.Physics.Arcade.Collider[] } {
  const { layerNames, collidableLayer, depthOffset = 0, create, position, collideWith } = options;

  const layers: CreatedTilemapLayer[] = [];

  const colliders: Phaser.Physics.Arcade.Collider[] = [];

  layerNames.forEach((layerName, depth) => {
    const layer = create(layerName);

    if (!layer) {
      console.error(`[tilemap] Failed to create layer: ${layerName}`);

      return;
    }

    position?.(layer);

    layer.setDepth(depth + depthOffset);

    layers.push(layer);

    if (layerName === collidableLayer) {
      layer.setCollisionByExclusion([-1]);

      if (collideWith) {
        colliders.push(scene.physics.add.collider(collideWith, layer));
      }
    }
  });

  return { layers, colliders };
}

export function findLayer(
  layers: readonly CreatedTilemapLayer[],
  layerName: string,
): CreatedTilemapLayer | undefined {
  return layers.find((layer) => layer.layer.name === layerName);
}
