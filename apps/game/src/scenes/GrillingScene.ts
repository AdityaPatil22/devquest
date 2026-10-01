import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GamePhase } from '../state/GameState';
import { SessionStore, type DecisionRecord } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';

import {
  DECISION_TILEMAP_KEY,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  DECISION_TILE_LAYERS,
  DECISION_COLLIDABLE_LAYER,
  DECISION_MAP_BOUNDS,
  DECISION_SPAWN,
  DECISION_DOOR_EXITS,
  patchDecisionRoomTilesets,
} from '../tilemaps/decisionRoomTilemap';

import {
  CORRIDOR_TILEMAP_KEY,
  CORRIDOR_TILESETS,
  CORRIDOR_TILE_LAYERS,
  CORRIDOR_COLLIDABLE_LAYER,
  CORRIDOR_MAP_TILE_SIZE,
  CORRIDOR_MAP_BOUNDS,
  CORRIDOR_MARKERS,
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
  OPTION_ROOM_MARKERS,
  OPTION_ROOM_DOOR_EXITS,
  patchOptionRoomTilesets,
} from '../tilemaps/optionRoomTilemap';

import type {
  ServerMessage,
  DecisionCreatedMsg,
  EvaluationMsg,
  SessionCompleteMsg,
  DecisionOption,
} from '../net/protocol';

import { emitUIEvent } from '../game/GameBridge';

interface DoorObject {
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

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;
  decision: DecisionCreatedMsg;
  restored?: boolean;
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
  objects: Phaser.GameObjects.GameObject[];
  colliders: Phaser.Physics.Arcade.Collider[];
  doors: DoorObject[];
}

const DOOR_SCALE = 0.191;
const DOOR_OPEN_SCALE = 0.191;

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

  /**
   * All generated world segments remain in the scene.
   *
   * Decision Room
   *   -> Corridor
   *   -> Option Room
   *   -> Corridor
   *   -> Option Room
   *   -> ...
   */
  private segments = new Map<string, WorldSegment>();

  /**
   * Room containing the currently active decision.
   */
  private activeRoomSegment?: WorldSegment;

  /**
   * Corridor waiting for the next decision to be generated.
   */
  private activeCorridorSegment?: WorldSegment;

  /**
   * Sequentially uses the available option room maps.
   */
  private optionRoomIndex = 0;

  /**
   * Combined physics bounds for the complete generated world.
   */
  private worldBounds?: Phaser.Geom.Rectangle;

  /**
   * Tracks player movement so the React UI only receives
   * state changes when movement actually changes.
   */
  private playerMoving = false;

  constructor() {
    super({
      key: 'GrillingScene',
    });
  }

  // ===========================================================================
  // Phaser Assets
  // ===========================================================================

  preload(): void {
    this.load.image(
      'door-closed',
      'assets/items/door-closed.png',
    );

    this.load.image(
      'door-open',
      'assets/items/door-open.png',
    );
  }

  // ===========================================================================
  // Scene Initialization
  // ===========================================================================

  init(data: SceneData): void {
    this.ws = data.ws;

    this.store = data.store;

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.currentDoor =
      undefined;

    this.doors = [];

    this.currentNodeId =
      data.decision.nodeId;

    /*
     * IMPORTANT:
     *
     * The continuous world is intentionally NOT reset here.
     *
     * The following state belongs to the complete GrillingScene world:
     *
     *   segments
     *   activeRoomSegment
     *   activeCorridorSegment
     *   optionRoomIndex
     *   worldBounds
     */

    this.data.set(
      'decision',
      data.decision,
    );

    this.data.set(
      'restored',
      data.restored ?? false,
    );

    /*
     * Prevent duplicate WebSocket subscriptions if
     * the scene is re-initialised.
     */
    this.unsubscribeWs?.();

    this.unsubscribeWs =
      this.ws.onMessage(
        this.handleMessage.bind(this),
      );
  }

  // ===========================================================================
  // Scene Creation
  // ===========================================================================

  create(): void {
    this.createPlayer();

    this.setupInput();

    const decision =
      this.data.get(
        'decision',
      ) as DecisionCreatedMsg;

    /*
     * Build the initial Decision Room only once.
     */
    if (
      this.segments.size ===
      0
    ) {
      this.buildInitialWorld(
        decision,
      );
    } else {
      /*
       * If the scene is recreated while the world still exists,
       * render the current decision in the active room.
       */
      const room =
        this.activeRoomSegment ??
        this.segments.get(
          INITIAL_ROOM_ID,
        );

      if (room) {
        this.activeRoomSegment =
          room;

        this.renderDecisionDoors(
          decision,
          room,
        );
      }
    }

    const restored =
      this.data.get(
        'restored',
      ) as boolean;

    if (restored) {
      this.restoreCurrentPhase();
    }

    this.emitUI({
      type:
        'DECISION_ROOM_READY',
    });
  }

  // ===========================================================================
  // Game Loop
  // ===========================================================================

  update(): void {
    if (
      this.phase ===
        GamePhase.EXPLORING_DOORS ||
      this.phase ===
        GamePhase.TRAVERSING_OPTION
    ) {
      this.player.handleMovement(
        this.cursors,
      );

      const body =
        this.player.sprite.body as
          | Phaser.Physics.Arcade.Body
          | null;

      const moving =
        Boolean(
          body &&
            body.velocity.lengthSq() >
              0,
        );

      if (
        moving !==
        this.playerMoving
      ) {
        this.playerMoving =
          moving;

        this.emitUI({
          type:
            'PLAYER_MOVING',
          visible:
            moving,
        });
      }

      if (
        this.phase ===
        GamePhase.EXPLORING_DOORS
      ) {
        this.checkDoorProximity();
      }

      return;
    }

    this.player.stop();

    if (
      this.playerMoving
    ) {
      this.playerMoving =
        false;

      this.emitUI({
        type:
          'PLAYER_MOVING',
        visible:
          false,
      });
    }
  }

  // ===========================================================================
  // Initial World
  // ===========================================================================

  private buildInitialWorld(
    decision: DecisionCreatedMsg,
  ): void {
    const room =
      this.buildDecisionRoom();

    this.activeRoomSegment =
      room;

    this.renderDecisionDoors(
      decision,
      room,
    );
  }

  // ===========================================================================
  // Decision Room
  // ===========================================================================

  private buildDecisionRoom(): WorldSegment {
    const cached =
      this.cache.tilemap.get(
        DECISION_TILEMAP_KEY,
      );

    if (cached?.data) {
      patchDecisionRoomTilesets(
        cached.data,
      );
    }

    const map =
      this.make.tilemap({
        key:
          DECISION_TILEMAP_KEY,
      });

    const tilesets =
      DECISION_TILESETS.map(
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

    const layers:
      CreatedTilemapLayer[] = [];

    const colliders:
      Phaser.Physics.Arcade.Collider[] =
      [];

    DECISION_TILE_LAYERS.forEach(
      (
        layerName,
        depth,
      ) => {
        const layer =
          map.createLayer(
            layerName,
            tilesets,
          );

        if (!layer) {
          console.error(
            `[GrillingScene] Failed to create decision layer: ${layerName}`,
          );

          return;
        }

        layer.setDepth(
          depth,
        );

        layers.push(
          layer,
        );

        if (
          layerName ===
          DECISION_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion(
            [-1],
          );

          const collider =
            this.physics.add.collider(
              this.player.sprite,
              layer,
            );

          colliders.push(
            collider,
          );
        }
      },
    );

    const width =
      (
        DECISION_MAP_BOUNDS.maxTileX -
        DECISION_MAP_BOUNDS.minTileX +
        1
      ) *
      DECISION_MAP_TILE_SIZE;

    const height =
      (
        DECISION_MAP_BOUNDS.maxTileY -
        DECISION_MAP_BOUNDS.minTileY +
        1
      ) *
      DECISION_MAP_TILE_SIZE;

    const x =
      DECISION_MAP_BOUNDS.minTileX *
      DECISION_MAP_TILE_SIZE;

    const y =
      DECISION_MAP_BOUNDS.minTileY *
      DECISION_MAP_TILE_SIZE;

    const segment:
      WorldSegment = {
      id:
        INITIAL_ROOM_ID,

      x,

      y,

      width,

      height,

      layers,

      objects: [],

      colliders,

      doors: [],
    };

    this.segments.set(
      segment.id,
      segment,
    );

    this.extendWorldBounds(
      x,
      y,
      x + width,
      y + height,
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

    this.optionRoomIndex +=
      1;

    const cached =
      this.cache.tilemap.get(
        roomKey,
      );

    if (cached?.data) {
      patchOptionRoomTilesets(
        cached.data,
      );
    }

    const map =
      this.make.tilemap({
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

    /*
     * ========================================================================
     * CORRIDOR EXIT
     * ========================================================================
     *
     * The corridor JSON owns the exit position.
     *
     * Do not use a hardcoded tile row/column here.
     */
    const corridorExit =
      CORRIDOR_MARKERS.roomExit;

    /*
     * The option room JSON owns its corridor entrance.
     */
    const optionEntrance =
      OPTION_ROOM_MARKERS.corridorEntrance;

    /*
     * Convert the corridor RoomExit marker from Tiled map coordinates
     * into world coordinates.
     *
     * The formula is:
     *
     * world = segment + marker - mapMinTile * tileSize
     */
    const corridorExitWorldX =
      corridor.x +
      corridorExit.x +
      corridorExit.width / 2 -
      CORRIDOR_MAP_BOUNDS.minTileX *
        CORRIDOR_MAP_TILE_SIZE;

    const corridorExitWorldY =
      corridor.y +
      corridorExit.y +
      corridorExit.height / 2 -
      CORRIDOR_MAP_BOUNDS.minTileY *
        CORRIDOR_MAP_TILE_SIZE;

    /*
     * Convert the option-room entrance marker into coordinates
     * relative to the option-room segment.
     */
    const optionEntranceLocalX =
      optionEntrance.x +
      optionEntrance.width / 2 -
      OPTION_ROOM_BOUNDS.minTileX *
        OPTION_ROOM_TILE_SIZE;

    const optionEntranceLocalY =
      optionEntrance.y +
      optionEntrance.height / 2 -
      OPTION_ROOM_BOUNDS.minTileY *
        OPTION_ROOM_TILE_SIZE;

    /*
     * ================================================================
     * EXACT CONNECTION
     * ================================================================
     *
     * The center of the corridor exit becomes exactly the center
     * of the option-room entrance.
     */
    const roomX =
      corridorExitWorldX -
      optionEntranceLocalX;

    const roomY =
      corridorExitWorldY -
      optionEntranceLocalY;

    /*
     * Position the actual Phaser TilemapLayer.
     */
    const layerX =
      roomX -
      OPTION_ROOM_BOUNDS.minTileX *
        OPTION_ROOM_TILE_SIZE;

    const layerY =
      roomY -
      OPTION_ROOM_BOUNDS.minTileY *
        OPTION_ROOM_TILE_SIZE;

    const layers:
      CreatedTilemapLayer[] = [];

    const colliders:
      Phaser.Physics.Arcade.Collider[] =
      [];

    OPTION_ROOM_TILE_LAYERS.forEach(
      (
        layerName,
        depth,
      ) => {
        const layer =
          map.createLayer(
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

        layer.setDepth(
          depth + 20,
        );

        layers.push(
          layer,
        );

        if (
          layerName ===
          OPTION_ROOM_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion(
            [-1],
          );

          const collider =
            this.physics.add.collider(
              this.player.sprite,
              layer,
            );

          colliders.push(
            collider,
          );
        }
      },
    );

    const roomId =
      `option-room-${this.optionRoomIndex}`;

    const segment:
      WorldSegment = {
      id:
        roomId,

      x:
        roomX,

      y:
        roomY,

      width:
        OPTION_ROOM_WIDTH_PX,

      height:
        OPTION_ROOM_HEIGHT_PX,

      layers,

      objects: [],

      colliders,

      doors: [],
    };

    this.segments.set(
      roomId,
      segment,
    );

    /*
     * Open both ends only after both maps exist.
     */
    this.openCorridorExit(
      corridor,
    );

    this.openOptionRoomEntrance(
      segment,
    );

    this.activeRoomSegment =
      segment;

    this.renderDecisionDoors(
      decision,
      segment,
    );

    this.extendWorldBounds(
      roomX,
      roomY,
      roomX +
        OPTION_ROOM_WIDTH_PX,
      roomY +
        OPTION_ROOM_HEIGHT_PX,
    );

    console.log(
      '[GrillingScene] Option Room connected:',
      {
        corridor:
          corridor.id,

        optionRoom:
          roomId,

        corridorExitWorld: {
          x:
            corridorExitWorldX,

          y:
            corridorExitWorldY,
        },

        optionEntranceWorld: {
          x:
            roomX +
            optionEntranceLocalX,

          y:
            roomY +
            optionEntranceLocalY,
        },
      },
    );

    return segment;
  }

  // ===========================================================================
  // Corridor
  // ===========================================================================

  private createCorridor(
    door: DoorObject,
  ): WorldSegment {
    const corridor =
      this.createCorridorAt(
        door,
      );

    this.activeCorridorSegment =
      corridor;

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

    const map =
      this.make.tilemap({
        key:
          CORRIDOR_TILEMAP_KEY,
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

    /*
     * ========================================================================
     * CORRIDOR ENTRANCE
     * ========================================================================
     *
     * The updated corridor JSON contains the actual RoomEntrance marker.
     *
     * Use its center as the connection point.
     */
    const corridorEntrance =
    CORRIDOR_MARKERS.entrance;

    const doorWorldX =
      door.x;

    const doorWorldY =
      door.y;

    const corridorEntranceLocalX =
      corridorEntrance.x +
      corridorEntrance.width / 2 -
      CORRIDOR_MAP_BOUNDS.minTileX *
        CORRIDOR_MAP_TILE_SIZE;

    const corridorEntranceLocalY =
      corridorEntrance.y +
      corridorEntrance.height / 2 -
      CORRIDOR_MAP_BOUNDS.minTileY *
        CORRIDOR_MAP_TILE_SIZE;

    /*
     * ========================================================================
     * EXACT DECISION -> CORRIDOR CONNECTION
     * ========================================================================
     *
     * The selected door position is the corridor entrance position.
     *
     * There are deliberately NO arbitrary offsets here.
     */
    const segmentX =
      doorWorldX -
      corridorEntranceLocalX;

    const segmentY =
      doorWorldY -
      corridorEntranceLocalY - 58;

    /*
     * Translate the Phaser tilemap layer so the authored
     * Tiled coordinates land at the calculated world position.
     */
    const layerX =
      segmentX;

    const layerY =
      segmentY;

    const layers:
      CreatedTilemapLayer[] = [];

    const colliders:
      Phaser.Physics.Arcade.Collider[] =
      [];

    CORRIDOR_TILE_LAYERS.forEach(
      (
        layerName,
        depth,
      ) => {
        const layer =
          map.createLayer(
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

        layer.setDepth(
          depth + 10,
        );

        layers.push(
          layer,
        );

        if (
          layerName ===
          CORRIDOR_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion(
            [-1],
          );

          /*
           * Only the outer perimeter blocks movement.
           */
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

          colliders.push(
            collider,
          );
        }
      },
    );

    const segment:
      WorldSegment = {
      id:
        `corridor-${this.segments.size}`,

      x:
        segmentX,

      y:
        segmentY,

      width,

      height,

      layers,

      objects: [],

      colliders,

      doors: [],
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

    console.log(
      '[GrillingScene] Corridor connected:',
      {
        corridor:
          segment.id,

        decisionDoor: {
          x:
            door.x,

          y:
            door.y,
        },

        corridorEntrance: {
          x:
            segmentX +
            corridorEntranceLocalX,

          y:
            segmentY +
            corridorEntranceLocalY,
        },

        corridorExit: this.getCorridorMarkerWorldPosition(
          segment,
          CORRIDOR_MARKERS.roomExit,
        ),
      },
    );

    return segment;
  }

  // ===========================================================================
  // Corridor Connections
  // ===========================================================================

  private openCorridorEntrance(
    corridor: WorldSegment,
  ): void {
    this.openMarkerCollision(
      corridor,
      CORRIDOR_COLLIDABLE_LAYER,
      CORRIDOR_MARKERS.entrance,
      CORRIDOR_MAP_TILE_SIZE,
    );
  }

  private openCorridorExit(
    corridor: WorldSegment,
  ): void {
    this.openMarkerCollision(
      corridor,
      CORRIDOR_COLLIDABLE_LAYER,
      CORRIDOR_MARKERS.roomExit,
      CORRIDOR_MAP_TILE_SIZE,
    );
  }

  private openOptionRoomEntrance(
    room: WorldSegment,
  ): void {
    this.openMarkerCollision(
      room,
      OPTION_ROOM_COLLIDABLE_LAYER,
      OPTION_ROOM_MARKERS.corridorEntrance,
      OPTION_ROOM_TILE_SIZE,
    );
  }

  private openMarkerCollision(
    segment: WorldSegment,
    layerName: string,
    marker: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
    tileSize: number,
  ): void {
    const wallLayer =
      this.getCollisionLayer(
        segment,
        layerName,
      );

    if (!wallLayer) {
      return;
    }

    const startX =
      Math.floor(
        marker.x /
          tileSize,
      );

    const endX =
      Math.ceil(
        (
          marker.x +
          marker.width
        ) /
          tileSize,
      ) -
      1;

    const startY =
      Math.floor(
        marker.y /
          tileSize,
      );

    const endY =
      Math.ceil(
        (
          marker.y +
          marker.height
        ) /
          tileSize,
      ) -
      1;

    /*
     * The marker is authored in Tiled map coordinates,
     * so these are map tile coordinates directly.
     */
    for (
      let y =
        startY;
      y <=
      endY;
      y += 1
    ) {
      for (
        let x =
          startX;
        x <=
        endX;
        x += 1
      ) {
        wallLayer
          .getTileAt(
            x,
            y,
            true,
          )
          ?.setCollision(
            false,
          );
      }
    }
  }

  // ===========================================================================
  // Decision Doors
  // ===========================================================================

  private renderDecisionDoors(
    decision: DecisionCreatedMsg,
    room: WorldSegment,
  ): void {
    /*
     * Remove only doors belonging to this room.
     *
     * The room/corridor tilemaps themselves remain untouched.
     */
    if (
      room.doors.length >
      0
    ) {
      [
        ...room.doors,
      ].forEach(
        (door) => {
          door.doorCollider.destroy();

          door.doorBlocker.destroy();

          door.doorSprite.destroy();

          const globalIndex =
            this.doors.indexOf(
              door,
            );

          if (
            globalIndex !==
            -1
          ) {
            this.doors.splice(
              globalIndex,
              1,
            );
          }
        },
      );

      room.doors = [];
    }

    this.currentDoor =
      undefined;

    this.currentNodeId =
      decision.nodeId;

    this.emitUI({
      type:
        'DECISION',

      nodeId:
        decision.nodeId,

      question:
        decision.question,

      description:
        decision.description,

      options:
        decision.options,

      recommendation:
        decision.recommendation,

      round:
        decision.round,
    });

    const doorKeys =
      [
        'A',
        'B',
        'C',
        'D',
      ] as const;

    decision.options.forEach(
      (
        option,
        index,
      ) => {
        const key =
          doorKeys[index];

        if (!key) {
          console.warn(
            `[GrillingScene] No door marker available for option ${index + 1}`,
          );

          return;
        }

        const marker =
          room.id ===
          INITIAL_ROOM_ID
            ? DECISION_DOOR_EXITS[
                key
              ]
            : OPTION_ROOM_DOOR_EXITS[
                key.toLowerCase() as
                  | 'a'
                  | 'b'
                  | 'c'
                  | 'd'
              ];

        const roomMinTileX =
          room.id ===
          INITIAL_ROOM_ID
            ? DECISION_MAP_BOUNDS.minTileX
            : OPTION_ROOM_BOUNDS.minTileX;

        const roomMinTileY =
          room.id ===
          INITIAL_ROOM_ID
            ? DECISION_MAP_BOUNDS.minTileY
            : OPTION_ROOM_BOUNDS.minTileY;

        const tileSize =
          room.id ===
          INITIAL_ROOM_ID
            ? DECISION_MAP_TILE_SIZE
            : OPTION_ROOM_TILE_SIZE;

        /*
         * Door interaction point:
         *
         *   X = center of marker
         *   Y = bottom edge of marker
         *
         * This preserves the existing visual door placement
         * from master while making all room connections use
         * the same world coordinate system.
         */
        const doorX =
          room.x +
          marker.x -
          roomMinTileX *
            tileSize +
          marker.width / 2;

        const doorY =
          room.y +
          marker.y -
          roomMinTileY *
            tileSize +
          marker.height;

        const DOOR_VISUAL_OFFSET_X =
          0;

        const DOOR_VISUAL_OFFSET_Y =
          32;

        const doorSprite =
          this.add
            .image(
              doorX +
                DOOR_VISUAL_OFFSET_X,
              doorY +
                DOOR_VISUAL_OFFSET_Y,
              'door-closed',
            )
            .setOrigin(
              0.5,
              1.42,
            )
            .setDepth(
              50,
            )
            .setScale(
              DOOR_SCALE,
              DOOR_SCALE * 1.25,
            );

        const doorBlocker =
          this.add.rectangle(
            doorX,
            doorY - 24,
            50,
            110,
            0x000000,
            0,
          );

        this.physics.add.existing(
          doorBlocker,
          true,
        );

        const doorCollider =
          this.physics.add.collider(
            this.player.sprite,
            doorBlocker,
          );

        const door:
          DoorObject = {
          option,

          key,

          x:
            doorX,

          y:
            doorY,

          doorSprite,

          doorBlocker,

          doorCollider,

          isOpen:
            false,

          roomId:
            room.id,

          roomSegment:
            room,
        };

        this.doors.push(
          door,
        );

        room.doors.push(
          door,
        );

        room.objects.push(
          doorSprite,
          doorBlocker,
        );
      },
    );

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type:
        'EXPLORING_DOORS',
    });
  }

  private removeSelectedDoor(
    door: DoorObject,
  ): void {
    const globalIndex =
      this.doors.indexOf(
        door,
      );

    if (
      globalIndex !==
      -1
    ) {
      this.doors.splice(
        globalIndex,
        1,
      );
    }

    const roomIndex =
      door.roomSegment.doors.indexOf(
        door,
      );

    if (
      roomIndex !==
      -1
    ) {
      door.roomSegment.doors.splice(
        roomIndex,
        1,
      );
    }

    const doorObjects = [
      door.doorSprite,
      door.doorBlocker,
    ];

    doorObjects.forEach(
      (object) => {
        const objectIndex =
          door.roomSegment.objects.indexOf(
            object,
          );

        if (
          objectIndex !==
          -1
        ) {
          door.roomSegment.objects.splice(
            objectIndex,
            1,
          );
        }

        object.destroy();
      },
    );

    door.doorCollider.destroy();

    if (
      this.currentDoor ===
      door
    ) {
      this.currentDoor =
        undefined;
    }
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

  private setDoorBarrierEnabled(
    door: DoorObject,
    enabled: boolean,
  ): void {
    const body =
      door.doorBlocker.body as
        | Phaser.Physics.Arcade.StaticBody
        | undefined;

    if (body) {
      body.enable =
        enabled;
    }
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

    const marker =
      DECISION_DOOR_EXITS[
        door.key
      ];

    const tileX =
      Math.floor(
        marker.x /
          DECISION_MAP_TILE_SIZE,
      );

    const tileY =
      Math.floor(
        marker.y /
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
      y >=
      minTileY;
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
        tile.index !==
          -1
      ) {
        wallStartY =
          y;

        break;
      }
    }

    if (
      wallStartY ===
      undefined
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
        y >=
        minTileY;
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
          tile.index ===
            -1
        ) {
          continue;
        }

        tile.setCollision(
          false,
        );
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
      | null =
      null;

    let minDist =
      Infinity;

    const activeDoors =
      this.activeRoomSegment
        ?.doors ?? [];

    for (
      const door of activeDoors
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
        minDist =
          distance;

        nearest =
          door;
      }
    }

    if (
      nearest &&
      nearest !==
        this.currentDoor
    ) {
      if (
        this.currentDoor
      ) {
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
      type:
        'DOOR_PROXIMITY',

      visible:
        true,

      option:
        door.option,
    });
  }

  private hideDoorPrompt(): void {
    const activeDoors =
      this.activeRoomSegment
        ?.doors ?? [];

    activeDoors.forEach(
      (door) => {
        door.doorSprite.clearTint();
      },
    );

    this.emitUI({
      type:
        'DOOR_PROXIMITY',

      visible:
        false,
    });
  }

  // ===========================================================================
  // Door Interaction
  // ===========================================================================

  private approachDoor(
    door: DoorObject,
  ): void {
    this.currentDoor =
      door;

    this.phase =
      GamePhase.DOOR_CONTEXT;

    this.player.stop();

    this.hideDoorPrompt();

    if (
      !door.isOpen
    ) {
      door.isOpen =
        true;

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

    this.setDoorBarrierEnabled(
      door,
      false,
    );

    this.openDoorwayCollision(
      door,
    );

    this.emitUI({
      type:
        'DOOR_CONTEXT',

      visible:
        true,

      option:
        door.option,
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

    /*
     * Preserve the master branch behaviour:
     * cancelling closes the UI flow by selecting the
     * current option without additional context.
     */
    if (
      !this.currentDoor
    ) {
      return;
    }

    const door =
      this.currentDoor;

    this.selectDoor(
      door,
    );
  }

  private selectDoor(
    door: DoorObject,
    context?: string,
  ): void {
    if (
      this.phase !==
      GamePhase.DOOR_CONTEXT
    ) {
      return;
    }

    this.phase =
      GamePhase.TRAVERSING_OPTION;

    this.player.stop();

    this.store.updateCurrent({
      selectedOptionId:
        door.option.id,

      context,
    });

    /*
     * Create exactly ONE corridor for the selected door.
     *
     * This is intentionally done here rather than in
     * approachDoor(), so the corridor is created only
     * after confirmation.
     */
    const corridor =
      this.createCorridor(
        door,
      );

    console.log(
      '[GrillingScene] Created corridor:',
      corridor.id,
      'for option:',
      door.option.id,
    );

    this.removeSelectedDoor(
      door,
    );

    this.emitUI({
      type:
        'AI_THINKING',

      visible:
        true,

      message:
        'Generating the next decision...',
    });

    this.emitUI({
      type:
        'OBJECTIVE',

      objective:
        'Walk through the corridor',
    });

    this.ws.send({
      type:
        'OPTION_SELECTED',

      nodeId:
        this.currentNodeId,

      optionId:
        door.option.id,

      context,
    });
  }

  // ===========================================================================
  // Door UI Anchors
  // ===========================================================================

  public getDoorOptionAnchors(): Array<{
    key: 'A' | 'B' | 'C' | 'D';
    label: string;
    x: number;
    y: number;
    active: boolean;
  }> {
    return (
      this.activeRoomSegment
        ?.doors ?? []
    ).map(
      (door) => ({
        key:
          door.key,

        label:
          door.option.label,

        x:
          door.x,

        y:
          door.y - 33,

        active:
          this.currentDoor ===
          door,
      }),
    );
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
    const next =
      new Phaser.Geom.Rectangle(
        left,
        top,
        right - left,
        bottom - top,
      );

    if (
      !this.worldBounds
    ) {
      this.worldBounds =
        next;
    } else {
      Phaser.Geom.Rectangle.MergeRect(
        this.worldBounds,
        next,
      );
    }

    const padding =
      32;

    this.physics.world.setBounds(
      this.worldBounds.x -
        padding,

      this.worldBounds.y -
        padding,

      this.worldBounds.width +
        padding * 2,

      this.worldBounds.height +
        padding * 2,
    );
  }

  // ===========================================================================
  // Marker Helpers
  // ===========================================================================

  private getCorridorMarkerWorldPosition(
    segment: WorldSegment,
    marker: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): {
    x: number;
    y: number;
  } {
    return {
      x:
        segment.x +
        marker.x -
        CORRIDOR_MAP_BOUNDS.minTileX *
          CORRIDOR_MAP_TILE_SIZE +
        marker.width / 2,

      y:
        segment.y +
        marker.y -
        CORRIDOR_MAP_BOUNDS.minTileY *
          CORRIDOR_MAP_TILE_SIZE +
        marker.height / 2,
    };
  }

  // ===========================================================================
  // Player
  // ===========================================================================

  private createPlayer(): void {
    this.player =
      new Player(
        this,
        DECISION_SPAWN.x,
        DECISION_SPAWN.y,
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
  // Decision History
  // ===========================================================================

  private emitDecisionHistory(
    record:
      | DecisionRecord
      | undefined,

    explanationOverride?: string,

    recommendedOption?: string,
  ): void {
    if (
      !record?.selectedOptionId
    ) {
      return;
    }

    const selectedOption =
      record.options.find(
        (option) =>
          option.id ===
          record.selectedOptionId,
      );

    if (
      !selectedOption
    ) {
      return;
    }

    const evaluationText =
      [
        record.feedback,
        record.consequence,
      ]
        .filter(
          (
            value,
          ): value is string =>
            Boolean(
              value?.trim(),
            ),
        )
        .join(
          '\n\n',
        );

    const explanation =
      explanationOverride
        ?.trim() ||
      evaluationText.trim() ||
      record.recommendation?.why?.trim();

    const finalRecommendedOption =
      recommendedOption
        ?.trim() ||
      record.recommendation?.option?.trim();

    if (
      !explanation &&
      !finalRecommendedOption
    ) {
      return;
    }

    this.emitUI({
      type:
        'DECISION_HISTORY',

      entry: {
        nodeId:
          record.nodeId,

        round:
          record.round,

        question:
          record.question,

        selectedOption,

        explanation,

        recommendedOption:
          finalRecommendedOption,
      },
    });
  }

  // ===========================================================================
  // Restore
  // ===========================================================================

  private restoreCurrentPhase(): void {
    const decision =
      this.store.getCurrentDecision();

    if (
      !decision
    ) {
      return;
    }

    for (
      const record of
        this.store.decisions
    ) {
      if (
        record.nodeId !==
        decision.nodeId
      ) {
        this.emitDecisionHistory(
          record,
        );
      }
    }

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type:
        'EXPLORING_DOORS',
    });
  }

  // ===========================================================================
  // Server Messages
  // ===========================================================================

  private handleMessage(
    msg: ServerMessage,
  ): void {
    switch (
      msg.type
    ) {
      // -----------------------------------------------------------------------
      // New Decision
      // -----------------------------------------------------------------------

      case 'DECISION_CREATED': {
        const decision =
          msg as DecisionCreatedMsg;

        console.log(
          '[GrillingScene] DECISION_CREATED:',
          decision.nodeId,
          'round:',
          decision.round,
        );

        /*
         * Ignore duplicate server events for the
         * currently displayed decision.
         */
        if (
          decision.nodeId ===
          this.currentNodeId
        ) {
          console.log(
            '[GrillingScene] Ignoring duplicate decision:',
            decision.nodeId,
          );

          break;
        }

        this.emitUI({
          type:
            'AI_THINKING',

          visible:
            false,
        });

        this.store.addDecision({
          nodeId:
            decision.nodeId,

          question:
            decision.question,

          description:
            decision.description,

          options:
            decision.options,

          recommendation:
            decision.recommendation,

          round:
            decision.round,
        });

        /*
         * Locate the most recently selected decision
         * for decision history.
         */
        const previousDecision =
          [
            ...this.store.decisions,
          ]
            .reverse()
            .find(
              (record) =>
                record.nodeId !==
                  decision.nodeId &&
                Boolean(
                  record.selectedOptionId,
                ),
            );

        if (
          previousDecision
        ) {
          this.emitDecisionHistory(
            previousDecision,

            decision
              .recommendation
              ?.why,

            decision
              .recommendation
              ?.option,
          );
        }

        /*
         * FIRST DECISION
         *
         * Round 1 stays in the original Decision Room.
         */
        if (
          decision.round === 1 &&
          !this.activeCorridorSegment
        ) {
          console.log(
            '[GrillingScene] Rendering initial Decision Room.',
          );

          if (
            !this.activeRoomSegment
          ) {
            this.buildInitialWorld(
              decision,
            );
          } else {
            this.renderDecisionDoors(
              decision,
              this.activeRoomSegment,
            );
          }

          this.currentNodeId =
            decision.nodeId;

          this.phase =
            GamePhase.EXPLORING_DOORS;

          this.emitUI({
            type:
              'OBJECTIVE',

            objective:
              'Choose a door',
          });

          this.emitUI({
            type:
              'EXPLORING_DOORS',
          });

          break;
        }

        /*
         * SUBSEQUENT DECISION
         *
         * A corridor must exist because the player
         * selected a door before the server generated
         * this decision.
         */
        const corridor =
          this.activeCorridorSegment;

        if (
          !corridor
        ) {
          console.error(
            '[GrillingScene] Missing corridor for subsequent decision:',
            decision.nodeId,
            'round:',
            decision.round,
          );

          this.emitUI({
            type:
              'AI_THINKING',

            visible:
              false,
          });

          this.emitUI({
            type:
              'ERROR',

            message:
              'Unable to create the next option room because the corridor is missing.',
          });

          break;
        }

        console.log(
          '[GrillingScene] Creating Option Room from corridor:',
          corridor.id,
          'for decision:',
          decision.nodeId,
        );

        this.buildOptionRoomFromCorridor(
          corridor,
          decision,
        );

        /*
         * The corridor is now connected to the
         * newly-created Option Room.
         */
        this.activeCorridorSegment =
          undefined;

        this.currentNodeId =
          decision.nodeId;

        this.phase =
          GamePhase.EXPLORING_DOORS;

        this.emitUI({
          type:
            'OBJECTIVE',

          objective:
            'Choose a door',
        });

        this.emitUI({
          type:
            'EXPLORING_DOORS',
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Session Complete
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
            store:
              this.store,
          },
        );

        break;
      }

      // -----------------------------------------------------------------------
      // Session Resumed
      // -----------------------------------------------------------------------

      case 'SESSION_RESUMED': {
        this.emitUI({
          type:
            'SESSION_RESUMED',
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Evaluation
      // -----------------------------------------------------------------------

      case 'EVALUATION': {
        const evaluation =
          msg as EvaluationMsg;

        const evaluatedDecision =
          this.store.decisions.find(
            (record) =>
              record.nodeId ===
              evaluation.nodeId,
          );

        if (
          evaluatedDecision
        ) {
          evaluatedDecision.feedback =
            evaluation.feedback;

          evaluatedDecision.consequence =
            evaluation.consequence;

          this.emitDecisionHistory(
            evaluatedDecision,
          );
        }

        this.emitUI({
          type:
            'AI_THINKING',

          visible:
            false,
        });

        this.emitUI({
          type:
            'EVALUATION',

          feedback:
            evaluation.feedback,

          consequence:
            evaluation.consequence,
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Error
      // -----------------------------------------------------------------------

      case 'ERROR': {
        console.error(
          '[GrillingScene] Server error:',
          msg.message,
        );

        this.emitUI({
          type:
            'AI_THINKING',

          visible:
            false,
        });

        this.emitUI({
          type:
            'ERROR',

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

  private destroySegment(
    segment: WorldSegment,
  ): void {
    segment.colliders.forEach(
      (collider) =>
        collider.destroy(),
    );

    segment.objects.forEach(
      (object) =>
        object.destroy(),
    );

    segment.layers.forEach(
      (layer) =>
        layer.destroy(),
    );
  }

  shutdown(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs =
      undefined;

    this.segments.forEach(
      (segment) =>
        this.destroySegment(
          segment,
        ),
    );

    this.segments.clear();

    this.doors = [];

    this.currentDoor =
      undefined;

    this.activeRoomSegment =
      undefined;

    this.activeCorridorSegment =
      undefined;

    this.worldBounds =
      undefined;

    this.playerMoving =
      false;
  }
}