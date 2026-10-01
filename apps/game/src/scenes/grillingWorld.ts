/**
 * World-segment types and the stateless geometry/tile helpers used by
 * GrillingScene.
 *
 * Only logic that needs no scene state lives here — the rest of the scene
 * shares a single mutable world (segments, active room, active corridor,
 * player, phase) and stays in GrillingScene.ts.
 */

import Phaser from 'phaser';

import type { DecisionOption } from '../net/protocol';
import { CORRIDOR_MAP_BOUNDS, CORRIDOR_MAP_TILE_SIZE } from '../tilemaps/corridorTilemap';

export type CreatedTilemapLayer = NonNullable<ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>>;

export interface DoorObject {
  option: DecisionOption;
  key: 'A' | 'B' | 'C' | 'D';
  x: number;
  y: number;
  doorSprite: Phaser.GameObjects.Image;
  doorBlocker: Phaser.GameObjects.Rectangle;
  doorCollider: Phaser.Physics.Arcade.Collider;
  isOpen: boolean;
  roomId: string;
  roomSegment: WorldSegment;
}

export interface WorldSegment {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layers: CreatedTilemapLayer[];
  objects: Phaser.GameObjects.GameObject[];
  colliders: Phaser.Physics.Arcade.Collider[];
  doors: DoorObject[];
}

export function getCollisionLayer(
  segment: WorldSegment,
  layerName: string,
): CreatedTilemapLayer | undefined {
  return segment.layers.find((layer) => layer.layer.name === layerName);
}

export function setDoorBarrierEnabled(door: DoorObject, enabled: boolean): void {
  const body = door.doorBlocker.body as Phaser.Physics.Arcade.StaticBody | undefined;

  if (body) {
    body.enable = enabled;
  }
}

/**
 * Walk up from a doorway and clear collision on the wall column above it
 * (plus one tile either side) so the player can pass through.
 */
export function clearVerticalWall(
  layer: CreatedTilemapLayer,
  centerTileX: number,
  startTileY: number,
  minTileY: number,
): void {
  let wallStartY: number | undefined;

  for (let y = startTileY - 1; y >= minTileY; y -= 1) {
    const tile = layer.getTileAt(centerTileX, y, true);

    if (tile && tile.index !== -1) {
      wallStartY = y;

      break;
    }
  }

  if (wallStartY === undefined) {
    return;
  }

  for (let x = centerTileX - 1; x <= centerTileX + 1; x += 1) {
    for (let y = wallStartY; y >= minTileY; y -= 1) {
      const tile = layer.getTileAt(x, y, true);

      if (!tile || tile.index === -1) {
        continue;
      }

      tile.setCollision(false);
    }
  }
}

/**
 * Convert a corridor marker authored in Tiled coordinates into the world
 * position of its center.
 */
export function getCorridorMarkerWorldPosition(
  segment: WorldSegment,
  marker: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  return {
    x:
      segment.x +
      marker.x -
      CORRIDOR_MAP_BOUNDS.minTileX * CORRIDOR_MAP_TILE_SIZE +
      marker.width / 2,

    y:
      segment.y +
      marker.y -
      CORRIDOR_MAP_BOUNDS.minTileY * CORRIDOR_MAP_TILE_SIZE +
      marker.height / 2,
  };
}

export function destroySegment(segment: WorldSegment): void {
  segment.colliders.forEach((collider) => collider.destroy());

  segment.objects.forEach((object) => object.destroy());

  segment.layers.forEach((layer) => layer.destroy());
}
