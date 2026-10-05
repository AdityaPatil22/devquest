/**
 * The unit the Grilling world is assembled from.
 *
 * A run is a chain of segments that all stay loaded:
 *
 *   Decision Room -> Corridor -> Option Room -> Corridor -> Option Room -> ...
 */

import Phaser from 'phaser';

import type { DecisionOption } from '../../net/protocol';
import type { CreatedTilemapLayer } from '../support/tilemap';

/** Id of the hand-authored room the first decision is always rendered in. */
export const INITIAL_ROOM_ID = 'decision-room';

export interface WorldSegment {
  id: string;
  /** World position of the segment's top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
  layers: CreatedTilemapLayer[];
  objects: Phaser.GameObjects.GameObject[];
  colliders: Phaser.Physics.Arcade.Collider[];
  doors: DoorObject[];
  exitBlocker?: Phaser.GameObjects.Rectangle;
  exitCollider?: Phaser.Physics.Arcade.Collider;
}

export interface DoorObject {
  option: DecisionOption;
  key: 'A' | 'B' | 'C' | 'D';
  /** World position of the doorway's interaction point. */
  x: number;
  y: number;
  doorSprite: Phaser.GameObjects.Image;
  doorBlocker: Phaser.GameObjects.Rectangle;
  doorCollider: Phaser.Physics.Arcade.Collider;
  isOpen: boolean;
  roomId: string;
  roomSegment: WorldSegment;
}

export function isInitialRoom(segment: WorldSegment): boolean {
  return segment.id === INITIAL_ROOM_ID;
}

export function destroySegment(segment: WorldSegment): void {
  segment.colliders.forEach((collider) => collider.destroy());

  segment.objects.forEach((object) => object.destroy());

  segment.layers.forEach((layer) => layer.destroy());
}
