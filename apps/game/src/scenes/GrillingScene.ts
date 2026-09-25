import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GamePhase } from '../state/GameState';
import { SessionStore } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';

import {
  DECISION_TILEMAP_KEY,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  DECISION_TILE_LAYERS,
  DECISION_COLLIDABLE_LAYER,
  DECISION_MAP_BOUNDS,
  DECISION_SPAWN_TILE,
  DECISION_DOOR_ROW_TILE_Y,
  DECISION_DOOR_ROW_X_RANGE,
  patchDecisionRoomTilesets,
} from '../tilemaps/decisionRoomTilemap';

import {
  CORRIDOR_TILEMAP_KEY,
  CORRIDOR_TILESETS,
  CORRIDOR_TILE_LAYERS,
  CORRIDOR_COLLIDABLE_LAYER,
  CORRIDOR_MAP_TILE_SIZE,
  CORRIDOR_MAP_BOUNDS,
  patchCorridorTilesets,
} from '../tilemaps/corridorTilemap';

import {
  OPTION_ROOM_TILEMAP_KEYS,
  OPTION_ROOM_TILE_LAYERS,
  OPTION_ROOM_COLLIDABLE_LAYER,
  OPTION_ROOM_TILESETS,
  OPTION_ROOM_TILE_SIZE,
  OPTION_ROOM_BOUNDS,
  OPTION_ROOM_WIDTH_PX,
  OPTION_ROOM_HEIGHT_PX,
  OPTION_ROOM_ENTRANCE_MIN_TILE_X,
  OPTION_ROOM_ENTRANCE_MAX_TILE_X,
  OPTION_ROOM_ENTRANCE_TILE_Y,
  patchOptionRoomTilesets,
} from '../tilemaps/optionRoomTilemap';

import type {
  ServerMessage,
  DecisionCreatedMsg,
  ChallengeMsg,
  EvaluationMsg,
  SessionCompleteMsg,
  DecisionOption,
} from '../net/protocol';

import { emitUIEvent } from '../game/GameBridge';

interface DoorObject {
  option: DecisionOption;
  x: number;
  y: number;
  doorSprite: Phaser.GameObjects.Image;
  isRecommended: boolean;
  isOpen: boolean;
  roomId: string;
  roomSegment: WorldSegment;
}

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;
  decision: DecisionCreatedMsg;
  restored?: boolean;
  devMode?: boolean;
}

type CreatedTilemapLayer = NonNullable<
  ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>
>;

interface WorldSegment {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layers: CreatedTilemapLayer[];
  objects: Phaser.GameObjects.Image[];
  colliders: Phaser.Physics.Arcade.Collider[];
}

const DOOR_SCALE = 0.191;
const DOOR_OPEN_SCALE = 0.191;

const CORRIDOR_ENTRANCE_MIN_TILE_X = 17;
const CORRIDOR_ENTRANCE_MAX_TILE_X = 19;
const CORRIDOR_ENTRANCE_TILE_Y = 39;

const CORRIDOR_EXIT_MIN_TILE_X = 17;
const CORRIDOR_EXIT_MAX_TILE_X = 19;
const CORRIDOR_EXIT_TILE_Y = -10;

const INITIAL_ROOM_ID = 'decision-room';

export class GrillingScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;

  private ws!: WebSocketClient;
  private store!: SessionStore;

  private phase = GamePhase.EXPLORING_DOORS;

  private doors: DoorObject[] = [];
  private currentDoor?: DoorObject;
  private currentNodeId = '';

  private unsubscribeWs?: () => void;
  private devMode = false;

  /**
   * Every rendered room/corridor is kept here.
   * Nothing is removed during normal gameplay.
   */
  private segments = new Map<string, WorldSegment>();

  /**
   * Room containing the currently active decision.
   */
  private activeRoomSegment?: WorldSegment;

  /**
   * Corridor created when the current door is selected.
   */
  private activeCorridorSegment?: WorldSegment;

  /**
   * Used to select room-1, room-2, room-3, room-4 sequentially.
   */
  private optionRoomIndex = 0;

  /**
   * Prevents generating the same corridor multiple times
   * when the user opens/cancels the context overlay.
   */
  private corridorGeneratedForCurrentDoor = false;

  constructor() {
    super({
      key: 'GrillingScene',
    });
  }

  // ===========================================================================
  // Phaser Assets
  // ===========================================================================

  preload(): void {
    this.load.image('door-closed', 'assets/items/door-closed.png');
    this.load.image('door-open', 'assets/items/door-open.png');
  }

  // ===========================================================================
  // Scene Initialization
  // ===========================================================================

  init(data: SceneData): void {
    this.ws = data.ws;
    this.store = data.store;
    this.devMode = data.devMode ?? false;

    this.phase = GamePhase.EXPLORING_DOORS;

    this.currentDoor = undefined;
    this.doors = [];

    this.currentNodeId = data.decision.nodeId;

    this.optionRoomIndex = 0;
    this.corridorGeneratedForCurrentDoor = false;

    this.activeRoomSegment = undefined;
    this.activeCorridorSegment = undefined;

    this.data.set('decision', data.decision);
    this.data.set('restored', data.restored ?? false);

    this.unsubscribeWs = this.ws.onMessage(
      this.handleMessage.bind(this),
    );
  }

  // ===========================================================================
  // Scene Creation
  // ===========================================================================

  create(): void {
    this.createPlayer();
    this.setupInput();

    const decision = this.data.get(
      'decision',
    ) as DecisionCreatedMsg;

    this.buildInitialWorld(decision);

    const restored = this.data.get('restored') as boolean;

    if (restored) {
      this.restoreCurrentPhase();
    }

    this.emitUI({
      type: 'DECISION_ROOM_READY',
    });
  }

  // ===========================================================================
  // Game Loop
  // ===========================================================================

  update(): void {
    if (
      this.phase === GamePhase.EXPLORING_DOORS ||
      this.phase === GamePhase.TRAVERSING_OPTION
    ) {
      this.player.handleMovement(this.cursors);

      if (this.phase === GamePhase.EXPLORING_DOORS) {
        this.checkDoorProximity();
      }
    } else {
      this.player.stop();
    }
  }

  // ===========================================================================
  // Initial World
  // ===========================================================================

  private buildInitialWorld(
    decision: DecisionCreatedMsg,
  ): void {
    const room = this.buildDecisionRoom();

    this.activeRoomSegment = room;

    this.renderDecisionDoors(decision, room);
  }

  // ===========================================================================
  // Decision Room
  // ===========================================================================

  private buildDecisionRoom(): WorldSegment {
    const cached = this.cache.tilemap.get(
      DECISION_TILEMAP_KEY,
    );

    if (cached?.data) {
      patchDecisionRoomTilesets(cached.data);
    }

    const map = this.make.tilemap({
      key: DECISION_TILEMAP_KEY,
    });

    const tilesets = DECISION_TILESETS.map((tileset) =>
      map.addTilesetImage(
        tileset.name,
        tileset.key,
      ),
    ).filter(
      (
        tileset,
      ): tileset is Phaser.Tilemaps.Tileset =>
        tileset !== null,
    );

    const layers: CreatedTilemapLayer[] = [];
    const colliders: Phaser.Physics.Arcade.Collider[] = [];

    DECISION_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer = map.createLayer(
          layerName,
          tilesets,
        );

        if (!layer) {
          console.error(
            `[GrillingScene] Failed to create decision layer: ${layerName}`,
          );
          return;
        }

        layer.setDepth(depth);

        layers.push(layer);

        if (
          layerName ===
          DECISION_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion([-1]);

          const collider =
            this.physics.add.collider(
              this.player.sprite,
              layer,
            );

          colliders.push(collider);
        }
      },
    );

    const width =
      (DECISION_MAP_BOUNDS.maxTileX -
        DECISION_MAP_BOUNDS.minTileX +
        1) *
      DECISION_MAP_TILE_SIZE;

    const height =
      (DECISION_MAP_BOUNDS.maxTileY -
        DECISION_MAP_BOUNDS.minTileY +
        1) *
      DECISION_MAP_TILE_SIZE;

    const x =
      DECISION_MAP_BOUNDS.minTileX *
      DECISION_MAP_TILE_SIZE;

    const y =
      DECISION_MAP_BOUNDS.minTileY *
      DECISION_MAP_TILE_SIZE;

    this.physics.world.setBounds(
      x,
      y,
      width,
      height,
    );

    const segment: WorldSegment = {
      id: INITIAL_ROOM_ID,
      x,
      y,
      width,
      height,
      layers,
      objects: [],
      colliders,
    };

    this.segments.set(
      segment.id,
      segment,
    );

    return segment;
  }

  // ===========================================================================
  // Option Room
  // ===========================================================================

  private buildOptionRoomFromCorridor(
    corridor: WorldSegment,
    decision: DecisionCreatedMsg,
  ): WorldSegment {
    const roomKey =
      OPTION_ROOM_TILEMAP_KEYS[
        this.optionRoomIndex %
          OPTION_ROOM_TILEMAP_KEYS.length
      ];

    this.optionRoomIndex += 1;

    const cached =
      this.cache.tilemap.get(roomKey);

    if (cached?.data) {
      patchOptionRoomTilesets(
        cached.data,
      );
    }

    const map = this.make.tilemap({
      key: roomKey,
    });

    const tilesets =
      OPTION_ROOM_TILESETS.map(
        (tileset) =>
          map.addTilesetImage(
            tileset.name,
            tileset.key,
          ),
      ).filter(
        (
          tileset,
        ): tileset is Phaser.Tilemaps.Tileset =>
          tileset !== null,
      );

    // -------------------------------------------------------------------------
    // Corridor exit position
    // -------------------------------------------------------------------------

    const corridorExitCenterTileX =
      (CORRIDOR_EXIT_MIN_TILE_X +
        CORRIDOR_EXIT_MAX_TILE_X) /
      2;

    const corridorExitCenterX =
      corridor.x +
      (
        corridorExitCenterTileX -
        CORRIDOR_MAP_BOUNDS.minTileX +
        0.5
      ) *
        CORRIDOR_MAP_TILE_SIZE;

    const corridorExitCenterY =
      corridor.y +
      (
        CORRIDOR_EXIT_TILE_Y -
        CORRIDOR_MAP_BOUNDS.minTileY +
        0.5
      ) *
        CORRIDOR_MAP_TILE_SIZE;

    // -------------------------------------------------------------------------
    // Option room entrance
    // -------------------------------------------------------------------------

    const optionRoomEntranceCenterTileX =
      (
        OPTION_ROOM_ENTRANCE_MIN_TILE_X +
        OPTION_ROOM_ENTRANCE_MAX_TILE_X
      ) / 2;

    const entranceOffsetX =
      (
        optionRoomEntranceCenterTileX -
        OPTION_ROOM_BOUNDS.minTileX +
        0.5
      ) *
        OPTION_ROOM_TILE_SIZE;

    const entranceOffsetY =
      (
        OPTION_ROOM_ENTRANCE_TILE_Y -
        OPTION_ROOM_BOUNDS.minTileY +
        0.5
      ) *
        OPTION_ROOM_TILE_SIZE;

    // -------------------------------------------------------------------------
    // Align room entrance with corridor exit
    // -------------------------------------------------------------------------

    const roomX =
      corridorExitCenterX -
      entranceOffsetX;

    const roomY =
      corridorExitCenterY -
      entranceOffsetY;

    // -------------------------------------------------------------------------
    // Create layers
    // -------------------------------------------------------------------------

    const layerX =
      roomX -
      OPTION_ROOM_BOUNDS.minTileX *
        OPTION_ROOM_TILE_SIZE;

    const layerY =
      roomY -
      OPTION_ROOM_BOUNDS.minTileY *
        OPTION_ROOM_TILE_SIZE;

    const layers: CreatedTilemapLayer[] = [];
    const colliders: Phaser.Physics.Arcade.Collider[] = [];

    OPTION_ROOM_TILE_LAYERS.forEach(
      () => {
        // Intentionally unused.
      },
    );

    OPTION_ROOM_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer = map.createLayer(
          layerName,
          tilesets,
          layerX,
          layerY,
        );

        if (!layer) {
          console.error(
            `[GrillingScene] Failed to create option room layer: ${layerName}`,
          );
          return;
        }

        layer.setDepth(depth + 20);

        layers.push(layer);

        if (
          layerName ===
          OPTION_ROOM_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion([-1]);

          const collider =
            this.physics.add.collider(
              this.player.sprite,
              layer,
            );

          colliders.push(collider);
        }
      },
    );

    const roomId =
      `option-room-${this.optionRoomIndex}`;

    const segment: WorldSegment = {
      id: roomId,
      x: roomX,
      y: roomY,
      width: OPTION_ROOM_WIDTH_PX,
      height: OPTION_ROOM_HEIGHT_PX,
      layers,
      objects: [],
      colliders,
    };

    this.segments.set(
      roomId,
      segment,
    );

    // -------------------------------------------------------------------------
    // Open the corridor exit and room entrance only after the room exists.
    // -------------------------------------------------------------------------

    this.openCorridorExit(corridor);

    this.openOptionRoomEntrance(
      segment,
    );

    this.activeRoomSegment = segment;
    this.activeCorridorSegment = undefined;

    this.renderDecisionDoors(
      decision,
      segment,
    );

    this.extendWorldBounds(
      roomX,
      roomY,
      roomX + OPTION_ROOM_WIDTH_PX,
      roomY + OPTION_ROOM_HEIGHT_PX,
    );

    return segment;
  }

  // ===========================================================================
  // Corridor
  // ===========================================================================

  private createCorridor(
    door: DoorObject,
  ): WorldSegment | undefined {
    if (
      this.corridorGeneratedForCurrentDoor &&
      this.activeCorridorSegment
    ) {
      return this.activeCorridorSegment;
    }

    const corridor =
      this.createCorridorAt(door);

    this.activeCorridorSegment =
      corridor;

    this.corridorGeneratedForCurrentDoor =
      true;

    this.openCorridorEntrance(
      corridor,
    );

    return corridor;
  }

  private createCorridorAt(
    door: DoorObject,
  ): WorldSegment {
    const cached =
      this.cache.tilemap.get(
        CORRIDOR_TILEMAP_KEY,
      );

    if (cached?.data) {
      patchCorridorTilesets(
        cached.data,
      );
    }

    const map = this.make.tilemap({
      key: CORRIDOR_TILEMAP_KEY,
    });

    const tilesets =
      CORRIDOR_TILESETS.map(
        (tileset) =>
          map.addTilesetImage(
            tileset.name,
            tileset.key,
          ),
      ).filter(
        (
          tileset,
        ): tileset is Phaser.Tilemaps.Tileset =>
          tileset !== null,
      );

    const width =
      (
        CORRIDOR_MAP_BOUNDS.maxTileX -
        CORRIDOR_MAP_BOUNDS.minTileX +
        1
      ) *
      CORRIDOR_MAP_TILE_SIZE;

    const height =
      (
        CORRIDOR_MAP_BOUNDS.maxTileY -
        CORRIDOR_MAP_BOUNDS.minTileY +
        1
      ) *
      CORRIDOR_MAP_TILE_SIZE;

    // -------------------------------------------------------------------------
    // Corridor entrance center inside the map
    // -------------------------------------------------------------------------

    const corridorEntranceCenterTileX =
      (
        CORRIDOR_ENTRANCE_MIN_TILE_X +
        CORRIDOR_ENTRANCE_MAX_TILE_X
      ) / 2;

    const corridorEntranceOffsetX =
      (
        corridorEntranceCenterTileX -
        CORRIDOR_MAP_BOUNDS.minTileX +
        0.5
      ) *
        CORRIDOR_MAP_TILE_SIZE;

    const corridorEntranceOffsetY =
      (
        CORRIDOR_ENTRANCE_TILE_Y -
        CORRIDOR_MAP_BOUNDS.minTileY +
        0.5
      ) *
        CORRIDOR_MAP_TILE_SIZE;

    // -------------------------------------------------------------------------
    // Position corridor directly below the selected door.
    // -------------------------------------------------------------------------

    const segmentX =
      door.x -
      corridorEntranceOffsetX - 400;

    const segmentY =
      door.y -
      corridorEntranceOffsetY - 350;

    const layerX =
      segmentX -
      CORRIDOR_MAP_BOUNDS.minTileX *
        CORRIDOR_MAP_TILE_SIZE;

    const layerY =
      segmentY -
      CORRIDOR_MAP_BOUNDS.minTileY *
        CORRIDOR_MAP_TILE_SIZE;

    const layers: CreatedTilemapLayer[] = [];
    const colliders: Phaser.Physics.Arcade.Collider[] = [];

    CORRIDOR_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer = map.createLayer(
          layerName,
          tilesets,
          layerX,
          layerY,
        );

        if (!layer) {
          console.error(
            `[GrillingScene] Failed to create corridor layer: ${layerName}`,
          );
          return;
        }

        layer.setDepth(depth + 10);

        layers.push(layer);

        if (
          layerName ===
          CORRIDOR_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion([-1]);

          // Only the outside wall tiles collide.
          for (
            let y =
              CORRIDOR_MAP_BOUNDS.minTileY;
            y <=
            CORRIDOR_MAP_BOUNDS.maxTileY;
            y += 1
          ) {
            for (
              let x =
                CORRIDOR_MAP_BOUNDS.minTileX;
              x <=
              CORRIDOR_MAP_BOUNDS.maxTileX;
              x += 1
            ) {
              const tile =
                layer.getTileAt(
                  x,
                  y,
                  true,
                );

              if (!tile) {
                continue;
              }

              const isOuterWall =
                x ===
                  CORRIDOR_MAP_BOUNDS.minTileX ||
                x ===
                  CORRIDOR_MAP_BOUNDS.maxTileX ||
                y ===
                  CORRIDOR_MAP_BOUNDS.minTileY ||
                y ===
                  CORRIDOR_MAP_BOUNDS.maxTileY;

              tile.setCollision(
                isOuterWall,
              );
            }
          }

          const collider =
            this.physics.add.collider(
              this.player.sprite,
              layer,
            );

          colliders.push(collider);
        }
      },
    );

    const segment: WorldSegment = {
      id: `corridor-${this.segments.size}`,
      x: segmentX,
      y: segmentY,
      width,
      height,
      layers,
      objects: [],
      colliders,
    };

    this.segments.set(
      segment.id,
      segment,
    );

    this.extendWorldBounds(
      segmentX,
      segmentY,
      segmentX + width,
      segmentY + height,
    );

    return segment;
  }

  // ===========================================================================
  // Corridor Entrance / Exit
  // ===========================================================================

  private openCorridorEntrance(
    corridor: WorldSegment,
  ): void {
    const wallLayer =
      corridor.layers.find(
        (layer) =>
          layer.layer.name ===
          CORRIDOR_COLLIDABLE_LAYER,
      );

    if (!wallLayer) {
      return;
    }

    // Open the bottom entrance.
    for (
      let x =
        CORRIDOR_ENTRANCE_MIN_TILE_X;
      x <=
      CORRIDOR_ENTRANCE_MAX_TILE_X;
      x += 1
    ) {
      wallLayer
        .getTileAt(
          x,
          CORRIDOR_ENTRANCE_TILE_Y,
          true,
        )
        ?.setCollision(false);
    }

    // IMPORTANT:
    // Do NOT open the corridor exit here.
    //
    // The player should be able to walk through the corridor
    // while the next decision is being generated, but should
    // not walk into empty space before the Option Room exists.
  }

  private openCorridorExit(
    corridor: WorldSegment,
  ): void {
    const wallLayer =
      corridor.layers.find(
        (layer) =>
          layer.layer.name ===
          CORRIDOR_COLLIDABLE_LAYER,
      );

    if (!wallLayer) {
      return;
    }

    for (
      let x =
        CORRIDOR_EXIT_MIN_TILE_X;
      x <=
      CORRIDOR_EXIT_MAX_TILE_X;
      x += 1
    ) {
      wallLayer
        .getTileAt(
          x,
          CORRIDOR_EXIT_TILE_Y,
          true,
        )
        ?.setCollision(false);
    }
  }

  private openOptionRoomEntrance(
    room: WorldSegment,
  ): void {
    const wallLayer =
      room.layers.find(
        (layer) =>
          layer.layer.name ===
          OPTION_ROOM_COLLIDABLE_LAYER,
      );

    if (!wallLayer) {
      return;
    }

    for (
      let x =
        OPTION_ROOM_ENTRANCE_MIN_TILE_X;
      x <=
      OPTION_ROOM_ENTRANCE_MAX_TILE_X;
      x += 1
    ) {
      wallLayer
        .getTileAt(
          x,
          OPTION_ROOM_ENTRANCE_TILE_Y,
          true,
        )
        ?.setCollision(false);
    }
  }

  // ===========================================================================
  // Decision Doors
  // ===========================================================================

  private renderDecisionDoors(
    decision: DecisionCreatedMsg,
    room: WorldSegment,
  ): void {
    this.currentNodeId =
      decision.nodeId;

    this.emitUI({
      type: 'DECISION',
      nodeId: decision.nodeId,
      question: decision.question,
      options: decision.options,
      recommendation:
        decision.recommendation,
      round: decision.round,
    });

    // The old room's doors must remain in the world.
    // Only reset the active-door collection.
    this.doors = [];
    this.currentDoor = undefined;

    const rangeStartTile =
      DECISION_DOOR_ROW_X_RANGE.minTileX;

    const rangeWidthTiles =
      DECISION_DOOR_ROW_X_RANGE.maxTileX -
      DECISION_DOOR_ROW_X_RANGE.minTileX +
      1;

    const rangeWidthPx =
      rangeWidthTiles *
      DECISION_MAP_TILE_SIZE;

    const spacing =
      decision.options.length > 0
        ? Math.min(
            120,
            rangeWidthPx /
              (decision.options.length + 1),
          )
        : 120;

    // Convert the room's local tile coordinate
    // into world coordinates.
    const doorRowLocalY =
      (
        DECISION_DOOR_ROW_TILE_Y -
        this.getRoomMinTileY(room)
      ) *
        DECISION_MAP_TILE_SIZE +
      DECISION_MAP_TILE_SIZE / 2;

    const doorY =
      room.y +
      doorRowLocalY;

    decision.options.forEach(
      (option, index) => {
        const localDoorX =
          (
            rangeStartTile -
            this.getRoomMinTileX(room)
          ) *
            DECISION_MAP_TILE_SIZE +
          spacing *
            (index + 1);

        const doorX =
          room.x +
          localDoorX;

        const isRecommended =
          decision.recommendation?.option ===
          option.id;

        const doorSprite =
          this.add
            .image(
              doorX,
              doorY,
              'door-closed',
            )
            .setOrigin(0.5, 1.42)
            .setDepth(50)
            .setScale(DOOR_SCALE);

        const door: DoorObject = {
          option,
          x: doorX,
          y: doorY,
          doorSprite,
          isRecommended,
          isOpen: false,
          roomId: room.id,
          roomSegment: room,
        };

        this.doors.push(door);

        room.objects.push(
          doorSprite,
        );
      },
    );

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type: 'EXPLORING_DOORS',
    });
  }

  private getRoomMinTileX(
    room: WorldSegment,
  ): number {
    if (
      room.id === INITIAL_ROOM_ID
    ) {
      return DECISION_MAP_BOUNDS.minTileX;
    }

    return OPTION_ROOM_BOUNDS.minTileX;
  }

  private getRoomMinTileY(
    room: WorldSegment,
  ): number {
    if (
      room.id === INITIAL_ROOM_ID
    ) {
      return DECISION_MAP_BOUNDS.minTileY;
    }

    return OPTION_ROOM_BOUNDS.minTileY;
  }

  // ===========================================================================
  // Door Collision
  // ===========================================================================

  private openDoorwayCollision(
    door: DoorObject,
  ): void {
    if (
      door.roomId ===
      INITIAL_ROOM_ID
    ) {
      this.openDecisionRoomDoorway(
        door,
      );
      return;
    }

    this.openOptionRoomDoorway(
      door,
    );
  }

  private openDecisionRoomDoorway(
    door: DoorObject,
  ): void {
    const wallLayer =
      this.getCollisionLayer(
        door.roomSegment,
        DECISION_COLLIDABLE_LAYER,
      );

    if (!wallLayer) {
      return;
    }

    const tileX =
      Math.floor(
        door.x /
          DECISION_MAP_TILE_SIZE,
      );

    const tileY =
      Math.floor(
        door.y /
          DECISION_MAP_TILE_SIZE,
      );

    this.clearVerticalWall(
      wallLayer,
      tileX,
      tileY,
      DECISION_MAP_BOUNDS.minTileY,
    );
  }

  private openOptionRoomDoorway(
    door: DoorObject,
  ): void {
    const wallLayer =
      this.getCollisionLayer(
        door.roomSegment,
        OPTION_ROOM_COLLIDABLE_LAYER,
      );

    if (!wallLayer) {
      return;
    }

    const room =
      door.roomSegment;

    const localX =
      door.x -
      room.x;

    const localY =
      door.y -
      room.y;

    const tileX =
      Math.floor(
        localX /
          OPTION_ROOM_TILE_SIZE,
      ) +
      OPTION_ROOM_BOUNDS.minTileX;

    const tileY =
      Math.floor(
        localY /
          OPTION_ROOM_TILE_SIZE,
      ) +
      OPTION_ROOM_BOUNDS.minTileY;

    this.clearVerticalWall(
      wallLayer,
      tileX,
      tileY,
      OPTION_ROOM_BOUNDS.minTileY,
    );
  }

  private clearVerticalWall(
    layer: CreatedTilemapLayer,
    centerTileX: number,
    startTileY: number,
    minTileY: number,
  ): void {
    let wallStartY:
      | number
      | undefined;

    for (
      let y =
        startTileY - 1;
      y >= minTileY;
      y -= 1
    ) {
      const tile =
        layer.getTileAt(
          centerTileX,
          y,
          true,
        );

      if (
        tile &&
        tile.index !== -1
      ) {
        wallStartY = y;
        break;
      }
    }

    if (
      wallStartY === undefined
    ) {
      return;
    }

    for (
      let x =
        centerTileX - 1;
      x <=
      centerTileX + 1;
      x += 1
    ) {
      for (
        let y =
          wallStartY;
        y >= minTileY;
        y -= 1
      ) {
        const tile =
          layer.getTileAt(
            x,
            y,
            true,
          );

        if (
          !tile ||
          tile.index === -1
        ) {
          continue;
        }

        tile.setCollision(false);
      }
    }
  }

  private getCollisionLayer(
    segment: WorldSegment,
    layerName: string,
  ): CreatedTilemapLayer | undefined {
    return segment.layers.find(
      (layer) =>
        layer.layer.name ===
        layerName,
    );
  }

  // ===========================================================================
  // Door Proximity
  // ===========================================================================

  private checkDoorProximity(): void {
    let nearest:
      | DoorObject
      | null = null;

    let minDist = Infinity;

    for (
      const door of this.doors
    ) {
      const distance =
        Phaser.Math.Distance.Between(
          this.player.sprite.x,
          this.player.sprite.y,
          door.x,
          door.y,
        );

      if (
        distance < 50 &&
        distance < minDist
      ) {
        minDist = distance;
        nearest = door;
      }
    }

    if (
      nearest &&
      nearest !== this.currentDoor
    ) {
      if (this.currentDoor) {
        this.currentDoor.doorSprite.clearTint();
      }

      this.currentDoor =
        nearest;

      this.showDoorPrompt(
        nearest,
      );
    } else if (
      !nearest &&
      this.currentDoor
    ) {
      this.currentDoor =
        undefined;

      this.hideDoorPrompt();
    }

    if (
      nearest &&
      Phaser.Input.Keyboard.JustDown(
        this.interactKey,
      )
    ) {
      this.approachDoor(
        nearest,
      );
    }
  }

  // ===========================================================================
  // Door Prompt
  // ===========================================================================

  private showDoorPrompt(
    door: DoorObject,
  ): void {
    door.doorSprite.setTint(
      0xffaa44,
    );

    this.emitUI({
      type: 'DOOR_PROXIMITY',
      visible: true,
      option: door.option,
    });
  }

  private hideDoorPrompt(): void {
    this.doors.forEach(
      (door) => {
        door.doorSprite.clearTint();
      },
    );

    this.emitUI({
      type: 'DOOR_PROXIMITY',
      visible: false,
    });
  }

  // ===========================================================================
  // Door Interaction
  // ===========================================================================

  private approachDoor(
    door: DoorObject,
  ): void {
    this.currentDoor = door;

    this.phase =
      GamePhase.DOOR_CONTEXT;

    this.player.stop();

    this.hideDoorPrompt();

    if (!door.isOpen) {
      door.isOpen = true;

      door.doorSprite
        .setTexture(
          'door-open',
        )
        .setOrigin(
          0.5,
          1.32,
        )
        .setScale(
          DOOR_OPEN_SCALE,
        );
    }

    this.openDoorwayCollision(
      door,
    );

    // Generate the corridor immediately.
    // It stays in the world even if the user
    // cancels the context overlay.
    this.createCorridor(
      door,
    );

    this.emitUI({
      type: 'DOOR_CONTEXT',
      visible: true,
      option: door.option,
    });
  }

  // ===========================================================================
  // Context Confirmation
  // ===========================================================================

  public confirmDoorSelection(
    context?: string,
  ): void {
    if (
      !this.currentDoor
    ) {
      return;
    }

    const door =
      this.currentDoor;

    this.selectDoor(
      door,
      context,
    );
  }

  public cancelDoorSelection(): void {
    if (
      this.phase !==
      GamePhase.DOOR_CONTEXT
    ) {
      return;
    }

    if (this.currentDoor) {
      this.currentDoor.isOpen =
        false;

      this.currentDoor.doorSprite
        .setTexture(
          'door-closed',
        )
        .setOrigin(
          0.5,
          1.42,
        )
        .setScale(
          DOOR_SCALE,
        );
    }

    /*
     * IMPORTANT:
     * Do not destroy the corridor.
     *
     * It has already been generated and belongs
     * to the continuous world.
     *
     * Keeping corridorGeneratedForCurrentDoor=true
     * also prevents creating duplicate corridors
     * if the player approaches the same door again.
     */
    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type: 'DOOR_CONTEXT',
      visible: false,
    });
  }

  private selectDoor(
    door: DoorObject,
    context?: string,
  ): void {
    this.phase =
      GamePhase.TRAVERSING_OPTION;

    this.store.updateCurrent({
      selectedOptionId:
        door.option.id,
      context,
    });

    this.ws.send({
      type: 'OPTION_SELECTED',
      nodeId:
        this.currentNodeId,
      optionId:
        door.option.id,
      context,
    });

    this.emitUI({
      type: 'DOOR_CONTEXT',
      visible: false,
    });
  }

  // ===========================================================================
  // World Bounds
  // ===========================================================================

  private extendWorldBounds(
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): void {
    const bounds =
      this.physics.world.bounds;

    const padding = 512;

    const minX =
      Math.min(
        bounds.x,
        left - padding,
      );

    const minY =
      Math.min(
        bounds.y,
        top - padding,
      );

    const maxX =
      Math.max(
        bounds.right,
        right + padding,
      );

    const maxY =
      Math.max(
        bounds.bottom,
        bottom + padding,
      );

    this.physics.world.setBounds(
      minX,
      minY,
      maxX - minX,
      maxY - minY,
    );
  }

  // ===========================================================================
  // Player
  // ===========================================================================

  private createPlayer(): void {
    const spawnX =
      DECISION_SPAWN_TILE.x *
        DECISION_MAP_TILE_SIZE +
      DECISION_MAP_TILE_SIZE / 2;

    const spawnY =
      DECISION_SPAWN_TILE.y *
        DECISION_MAP_TILE_SIZE +
      DECISION_MAP_TILE_SIZE / 2;

    this.player =
      new Player(
        this,
        spawnX,
        spawnY,
      );

    this.player.sprite.setDepth(
      50,
    );

    this.player.sprite.setCollideWorldBounds(
      false,
    );

    this.cameras.main.startFollow(
      this.player.sprite,
      true,
      0.1,
      0.1,
    );

    this.cameras.main.setDeadzone(
      120,
      80,
    );
  }

  // ===========================================================================
  // Keyboard
  // ===========================================================================

  private setupInput(): void {
    this.cursors =
      this.input.keyboard!.createCursorKeys();

    this.interactKey =
      this.input.keyboard!.addKey(
        Phaser.Input.Keyboard.KeyCodes.E,
      );
  }

  // ===========================================================================
  // UI
  // ===========================================================================

  private emitUI(
    event: Parameters<
      typeof emitUIEvent
    >[1],
  ): void {
    emitUIEvent(
      this.game,
      event,
    );
  }

  // ===========================================================================
  // Restore
  // ===========================================================================

  private restoreCurrentPhase(): void {
    const decision =
      this.store.getCurrentDecision();

    if (!decision) {
      return;
    }

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type: 'EXPLORING_DOORS',
    });
  }

  // ===========================================================================
  // Server Messages
  // ===========================================================================

  private handleMessage(
    msg: ServerMessage,
  ): void {
    switch (msg.type) {
      // -----------------------------------------------------------------------
      // New decision generated by the server
      // -----------------------------------------------------------------------

      case 'DECISION_CREATED': {
        const decision =
          msg as DecisionCreatedMsg;

        this.store.addDecision({
          nodeId:
            decision.nodeId,
          question:
            decision.question,
          options:
            decision.options,
          recommendation:
            decision.recommendation,
          round:
            decision.round,
        });

        /*
         * The important continuous-world transition:
         *
         * OLD:
         *   DECISION_CREATED
         *       -> create another Decision Room
         *
         * NEW:
         *   DECISION_CREATED
         *       -> use current corridor
         *       -> create Option Room at corridor exit
         *       -> render new decision doors inside it
         */
        if (
          !this.activeCorridorSegment
        ) {
          console.error(
            '[GrillingScene] DECISION_CREATED received without an active corridor.',
          );

          this.emitUI({
            type: 'ERROR',
            message:
              'Received a new decision before the corridor was ready.',
          });

          break;
        }

        this.buildOptionRoomFromCorridor(
          this.activeCorridorSegment,
          decision,
        );

        this.phase =
          GamePhase.EXPLORING_DOORS;

        break;
      }

      // -----------------------------------------------------------------------
      // Session complete
      // -----------------------------------------------------------------------

      case 'SESSION_COMPLETE': {
        const complete =
          msg as SessionCompleteMsg;

        this.store.complete(
          complete.summary,
          complete.docContent,
        );

        this.player.stop();

        this.scene.start(
          'TrophyScene',
          {
            store: this.store,
          },
        );

        break;
      }

      // -----------------------------------------------------------------------
      // Session resumed
      // -----------------------------------------------------------------------

      case 'SESSION_RESUMED': {
        this.emitUI({
          type: 'SESSION_RESUMED',
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Evaluation
      // -----------------------------------------------------------------------

      case 'EVALUATION': {
        const evaluation =
          msg as EvaluationMsg;
      
        this.emitUI({
          type: 'EVALUATION',
          feedback: evaluation.feedback,
          consequence: evaluation.consequence,
        });
      
        break;
      }

      // -----------------------------------------------------------------------
      // Error
      // -----------------------------------------------------------------------

      case 'ERROR': {
        console.error(
          'Server error:',
          msg.message,
        );

        this.emitUI({
          type: 'ERROR',
          message:
            msg.message,
        });

        break;
      }
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  private removeSegment(
    id: string,
  ): void {
    const segment =
      this.segments.get(id);

    if (!segment) {
      return;
    }

    segment.colliders.forEach(
      (collider) => {
        collider.destroy();
      },
    );

    segment.objects.forEach(
      (object) => {
        object.destroy();
      },
    );

    segment.layers.forEach(
      (layer) => {
        layer.destroy();
      },
    );

    this.segments.delete(id);

    if (
      segment ===
      this.activeRoomSegment
    ) {
      this.activeRoomSegment =
        undefined;
    }

    if (
      segment ===
      this.activeCorridorSegment
    ) {
      this.activeCorridorSegment =
        undefined;
    }
  }

  private leaveBoot(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs =
      undefined;
  }

  shutdown(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs =
      undefined;

    this.segments.forEach(
      (segment) => {
        segment.colliders.forEach(
          (collider) => {
            collider.destroy();
          },
        );

        segment.objects.forEach(
          (object) => {
            object.destroy();
          },
        );

        segment.layers.forEach(
          (layer) => {
            layer.destroy();
          },
        );
      },
    );

    this.segments.clear();

    this.doors = [];

    this.currentDoor =
      undefined;

    this.activeRoomSegment =
      undefined;

    this.activeCorridorSegment =
      undefined;

    this.corridorGeneratedForCurrentDoor =
      false;
  }
}