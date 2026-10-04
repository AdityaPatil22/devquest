/**
 * Owns the four doors a decision is presented as: spawning them from the
 * authored exit markers, highlighting the one the player is standing at,
 * opening it, and tearing them down again.
 *
 * It reports what the player did by returning values; GrillingScene decides
 * what that means for the phase, the session and the server.
 */

import Phaser from 'phaser';

import {
  DECISION_COLLIDABLE_LAYER,
  DECISION_DOOR_EXITS,
  DECISION_MAP_BOUNDS,
  DECISION_MAP_TILE_SIZE,
} from '../../tilemaps/decisionRoomTilemap';

import {
  OPTION_ROOM_BOUNDS,
  OPTION_ROOM_COLLIDABLE_LAYER,
  OPTION_ROOM_DOOR_EXITS,
  OPTION_ROOM_TILE_SIZE,
} from '../../tilemaps/optionRoomTilemap';

import type { DecisionCreatedMsg } from '../../net/protocol';
import { emitUI } from '../support/sceneUi';
import { findLayer } from '../support/tilemap';
import { clearVerticalWall, markerCenter, type Marker, type TileBounds } from './geometry';
import { isInitialRoom, type DoorObject, type WorldSegment } from './segment';

const DOOR_KEYS = ['A', 'B', 'C', 'D'] as const;

const DOOR_SCALE = 0.191;

/** How close the player must stand before a door can be entered, in pixels. */
const INTERACT_DISTANCE = 50;

/** The sprite sits slightly above its interaction point. */
const DOOR_VISUAL_OFFSET_Y = 32;

const HIGHLIGHT_TINT = 0xffaa44;

/**
 * Both room types author their door exits the same way, they just use
 * different marker sets and tile geometry.
 */
function roomDoorPlacement(room: WorldSegment): {
  exits: Record<string, Marker>;
  bounds: TileBounds;
  tileSize: number;
  collidableLayer: string;
} {
  return isInitialRoom(room)
    ? {
        exits: DECISION_DOOR_EXITS,
        bounds: DECISION_MAP_BOUNDS,
        tileSize: DECISION_MAP_TILE_SIZE,
        collidableLayer: DECISION_COLLIDABLE_LAYER,
      }
    : {
        exits: OPTION_ROOM_DOOR_EXITS,
        bounds: OPTION_ROOM_BOUNDS,
        tileSize: OPTION_ROOM_TILE_SIZE,
        collidableLayer: OPTION_ROOM_COLLIDABLE_LAYER,
      };
}

/** The option-room marker set is keyed in lowercase. */
function exitMarker(room: WorldSegment, key: (typeof DOOR_KEYS)[number]): Marker | undefined {
  const { exits } = roomDoorPlacement(room);

  return exits[key] ?? exits[key.toLowerCase()];
}

export class DecisionDoors {
  private current?: DoorObject;

  constructor(
    private readonly scene: Phaser.Scene,
    private playerSprite: Phaser.Physics.Arcade.Sprite,
  ) {}

  get currentDoor(): DoorObject | undefined {
    return this.current;
  }

  /** See GrillingWorld.setPlayer — the scene rebuilds the player on restart. */
  setPlayer(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.playerSprite = sprite;
  }

  /** Forget the highlighted door; the sprites go away with their segment. */
  reset(): void {
    this.current = undefined;
  }

  // ===========================================================================
  // Spawning
  // ===========================================================================

  /** Replace whatever doors `room` was showing with this decision's options. */
  render(decision: DecisionCreatedMsg, room: WorldSegment): void {
    this.clear(room);

    decision.options.forEach((option, index) => {
      const key = DOOR_KEYS[index];

      const marker = key && exitMarker(room, key);

      if (!key || !marker) {
        console.warn(`[DecisionDoors] No door marker available for option ${index + 1}`);

        return;
      }

      const { bounds, tileSize } = roomDoorPlacement(room);

      const center = markerCenter(marker, bounds, tileSize);

      /*
       * The interaction point is the bottom edge of the marker, so the player
       * triggers the door by standing in the doorway rather than inside the
       * wall it is cut into.
       */
      const x = room.x + center.x;

      const y = room.y + center.y + marker.height / 2;

      const doorSprite = this.scene.add
        .image(x, y + DOOR_VISUAL_OFFSET_Y, 'door-closed')
        .setOrigin(0.5, 1.42)
        .setDepth(50)
        .setScale(DOOR_SCALE, DOOR_SCALE * 1.25);

      const doorBlocker = this.scene.add.rectangle(x, y - 24, 50, 110, 0x000000, 0);

      this.scene.physics.add.existing(doorBlocker, true);

      const door: DoorObject = {
        option,
        key,
        x,
        y,
        doorSprite,
        doorBlocker,
        doorCollider: this.scene.physics.add.collider(this.playerSprite, doorBlocker),
        isOpen: false,
        roomId: room.id,
        roomSegment: room,
      };

      room.doors.push(door);

      room.objects.push(doorSprite, doorBlocker);
    });
  }

  /** Destroy every door in a room, leaving its tilemap untouched. */
  clear(room: WorldSegment): void {
    [...room.doors].forEach((door) => this.remove(door));

    room.doors = [];

    this.current = undefined;
  }

  remove(door: DoorObject): void {
    const room = door.roomSegment;

    room.doors = room.doors.filter((other) => other !== door);

    [door.doorSprite, door.doorBlocker].forEach((object) => {
      room.objects = room.objects.filter((other) => other !== object);

      object.destroy();
    });

    door.doorCollider.destroy();

    if (this.current === door) {
      this.current = undefined;
    }
  }

  // ===========================================================================
  // Proximity
  // ===========================================================================

  /**
   * Highlight the door the player is standing at (and un-highlight the rest),
   * returning it so the caller can act on an interact keypress.
   */
  updateProximity(room: WorldSegment | undefined): DoorObject | undefined {
    const nearest = this.nearestDoor(room);

    if (nearest === this.current) {
      return nearest;
    }

    if (this.current) {
      this.current.doorSprite.clearTint();
    }

    this.current = nearest;

    if (nearest) {
      nearest.doorSprite.setTint(HIGHLIGHT_TINT);

      emitUI(this.scene, { type: 'DOOR_PROXIMITY', visible: true, option: nearest.option });
    } else {
      this.hidePrompt(room);
    }

    return nearest;
  }

  private nearestDoor(room: WorldSegment | undefined): DoorObject | undefined {
    let nearest: DoorObject | undefined;

    let minDistance = INTERACT_DISTANCE;

    for (const door of room?.doors ?? []) {
      const distance = Phaser.Math.Distance.Between(
        this.playerSprite.x,
        this.playerSprite.y,
        door.x,
        door.y,
      );

      if (distance < minDistance) {
        minDistance = distance;

        nearest = door;
      }
    }

    return nearest;
  }

  private hidePrompt(room: WorldSegment | undefined): void {
    (room?.doors ?? []).forEach((door) => door.doorSprite.clearTint());

    emitUI(this.scene, { type: 'DOOR_PROXIMITY', visible: false });
  }

  // ===========================================================================
  // Opening
  // ===========================================================================

  /** Swap in the open sprite and cut a walkable gap through the wall above. */
  open(door: DoorObject): void {
    this.current = door;

    this.hidePrompt(door.roomSegment);

    if (!door.isOpen) {
      door.isOpen = true;

      door.doorSprite
        .setTexture('door-open')
        .setOrigin(0.4, 1.34)
        .setDepth(50)
        .setScale(DOOR_SCALE, DOOR_SCALE * 1.25);
    }

    const body = door.doorBlocker.body as Phaser.Physics.Arcade.StaticBody | undefined;

    if (body) {
      body.enable = false;
    }

    this.openDoorway(door);
  }

  private openDoorway(door: DoorObject): void {
    const room = door.roomSegment;

    const { bounds, tileSize, collidableLayer } = roomDoorPlacement(room);

    const wallLayer = findLayer(room.layers, collidableLayer);

    if (!wallLayer) {
      return;
    }

    /*
     * The Decision Room's markers are read straight from the map, while an
     * option room can sit anywhere in the world, so its doorway is located
     * from the door's position relative to the room.
     */
    const { tileX, tileY } = isInitialRoom(room)
      ? {
          tileX: Math.floor(DECISION_DOOR_EXITS[door.key].x / tileSize),
          tileY: Math.floor(DECISION_DOOR_EXITS[door.key].y / tileSize),
        }
      : {
          tileX: Math.floor((door.x - room.x) / tileSize) + bounds.minTileX,
          tileY: Math.floor((door.y - room.y) / tileSize) + bounds.minTileY,
        };

    clearVerticalWall(wallLayer, tileX, tileY, bounds.minTileY);
  }

  // ===========================================================================
  // UI anchors
  // ===========================================================================

  /** Screen anchors the React overlay pins each option label to. */
  anchors(room: WorldSegment | undefined): Array<{
    key: (typeof DOOR_KEYS)[number];
    label: string;
    x: number;
    y: number;
    active: boolean;
  }> {
    return (room?.doors ?? []).map((door) => ({
      key: door.key,
      label: door.option.label,
      x: door.x,
      y: door.y - 28,
      active: this.current === door,
    }));
  }
}
