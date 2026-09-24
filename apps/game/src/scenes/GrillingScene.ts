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
  OPTION_ROOM_WIDTH_PX,
  OPTION_ROOM_HEIGHT_PX,
  OPTION_ROOM_TILESETS,
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
}

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;
  decision: DecisionCreatedMsg;
  restored?: boolean;
  devMode?: boolean;
}

const DOOR_SCALE = 0.191;
const DOOR_OPEN_SCALE = 0.191;
const OPTION_ROOM_1_KEY = OPTION_ROOM_TILEMAP_KEYS[0];

export class GrillingScene extends Phaser.Scene {
  private player!: Player;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private interactKey!: Phaser.Input.Keyboard.Key;

  private ws!: WebSocketClient;

  private store!: SessionStore;

  private map!: Phaser.Tilemaps.Tilemap;

  private wallsLayer?: ReturnType<
    Phaser.Tilemaps.Tilemap['createLayer']
  >;

  private doors: DoorObject[] = [];

  private phase = GamePhase.EXPLORING_DOORS;

  private currentDoor?: DoorObject;

  private currentNodeId = '';

  private unsubscribeWs?: () => void;

  private devMode = false;

  // ---------------------------------------------------------------------------
  // Continuous world tracking
  // ---------------------------------------------------------------------------

  /**
   * World-space Y where the next segment
   * (corridor, option room, or decision room)
   * should be placed.
   *
   * Updated after each segment is created.
   */
  private worldBottomY = 0;

  /**
   * Y offset of the currently active decision
   * room tilemap.
   *
   * Round 1 → 0.
   * Round 2+ → cumulative height of all
   *            preceding segments.
   */
  private decisionRoomOffsetY = 0;

  constructor() {
    super({
      key: 'GrillingScene',
    });
  }

  // ---------------------------------------------------------------------------
  // Phaser assets
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Scene initialization
  // ---------------------------------------------------------------------------

  init(data: SceneData): void {
    this.ws = data.ws;

    this.store = data.store;

    this.devMode = data.devMode ?? false;

    this.phase = GamePhase.EXPLORING_DOORS;

    this.currentDoor = undefined;

    this.doors = [];

    this.currentNodeId = data.decision.nodeId;

    this.data.set('decision', data.decision);

    this.data.set(
      'restored',
      data.restored ?? false,
    );

    this.unsubscribeWs = this.ws.onMessage(
      this.handleMessage.bind(this),
    );
  }

  // ---------------------------------------------------------------------------
  // Scene creation
  // ---------------------------------------------------------------------------

  create(): void {
    this.createPlayer();

    this.setupInput();

    this.buildInitialWorld();

    const decision =
      this.data.get('decision') as DecisionCreatedMsg;

    this.renderDecision(decision);

    const restored =
      this.data.get('restored') as boolean;

    if (restored) {
      this.restoreCurrentPhase();
    }

    this.emitUI({
      type: 'DECISION_ROOM_READY',
    });
  }

  // ---------------------------------------------------------------------------
  // Phaser game loop
  // ---------------------------------------------------------------------------

  update(): void {
    if (
      this.phase === GamePhase.EXPLORING_DOORS ||
      this.phase === GamePhase.TRAVERSING_OPTION
    ) {
      this.player.handleMovement(this.cursors);

      if (
        this.phase === GamePhase.EXPLORING_DOORS
      ) {
        this.checkDoorProximity();
      }
    } else {
      this.player.stop();
    }
  }

  // ---------------------------------------------------------------------------
  // Initial continuous world
  // ---------------------------------------------------------------------------

  private buildInitialWorld(): void {
    // 1. Decision Room
    this.buildRoom();

    // Center the corridor under the Decision Room.
    const decisionCenterX =
      (
        DECISION_MAP_BOUNDS.minTileX +
        DECISION_MAP_BOUNDS.maxTileX +
        1
      ) *
      DECISION_MAP_TILE_SIZE /
      2;

    // 2. Corridor
    const corridor =
      this.createCorridorAt(
        decisionCenterX,
      );

    // 3. Room-1
    this.buildRoom1(
      corridor,
    );
  }

  // ---------------------------------------------------------------------------
  // Corridor
  // ---------------------------------------------------------------------------

  private createCorridor(
    door: DoorObject,
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return this.createCorridorAt(
      door.x,
    );
  }

  private createCorridorAt(
    centerX: number,
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
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

    const tilesets = CORRIDOR_TILESETS
      .map((tileset) =>
        map.addTilesetImage(
          tileset.name,
          tileset.key,
        ),
      )
      .filter(
        (
          tileset,
        ): tileset is Phaser.Tilemaps.Tileset =>
          tileset !== null,
      );

    const corridorWidth =
      CORRIDOR_MAP_BOUNDS.maxTileX -
      CORRIDOR_MAP_BOUNDS.minTileX +
      1;

    const corridorHeight =
      CORRIDOR_MAP_BOUNDS.maxTileY -
      CORRIDOR_MAP_BOUNDS.minTileY +
      1;

    const corridorWidthPx =
      corridorWidth *
      CORRIDOR_MAP_TILE_SIZE;

    const corridorHeightPx =
      corridorHeight *
      CORRIDOR_MAP_TILE_SIZE;

    const corridorX =
      centerX -
      corridorWidthPx / 2;

    const corridorY =
      this.worldBottomY;

    console.log(
      '[GrillingScene] Creating corridor:',
      {
        x: corridorX,
        y: corridorY,
        width: corridorWidthPx,
        height: corridorHeightPx,
        centerX,
      },
    );

    CORRIDOR_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer =
          map.createLayer(
            layerName,
            tilesets,
            corridorX,
            corridorY,
          );

        if (!layer) {
          console.error(
            `[GrillingScene] Failed to create corridor layer: ${layerName}`,
          );

          return;
        }

        layer.setDepth(depth);

        if (
          layerName ===
          CORRIDOR_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion(
            [-1],
          );

          this.physics.add.collider(
            this.player.sprite,
            layer,
          );
        }
      },
    );

    const corridorLeft =
      corridorX;

    const corridorTop =
      corridorY;

    const corridorRight =
      corridorX +
      corridorWidthPx;

    const corridorBottom =
      corridorY +
      corridorHeightPx;

    this.extendWorldBounds(
      corridorLeft,
      corridorTop,
      corridorRight,
      corridorBottom,
    );

    this.worldBottomY =
      corridorBottom;

    return {
      x: corridorX,
      y: corridorY,
      width: corridorWidthPx,
      height: corridorHeightPx,
    };
  }

  // ---------------------------------------------------------------------------
  // Room-1
  // ---------------------------------------------------------------------------

  private buildRoom1(
    corridor: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): void {
    const cached =
      this.cache.tilemap.get(
        OPTION_ROOM_1_KEY,
      );

    if (cached?.data) {
      patchOptionRoomTilesets(
        cached.data,
      );
    }

    const map =
      this.make.tilemap({
        key: OPTION_ROOM_1_KEY,
      });

    const tilesets =
      OPTION_ROOM_TILESETS
        .map((tileset) =>
          map.addTilesetImage(
            tileset.name,
            tileset.key,
          ),
        )
        .filter(
          (
            tileset,
          ): tileset is Phaser.Tilemaps.Tileset =>
            tileset !== null,
        );

    const roomX =
      corridor.x +
      corridor.width / 2 -
      OPTION_ROOM_WIDTH_PX / 2;

    const roomY =
      corridor.y +
      corridor.height;

    console.log(
      '[GrillingScene] Creating Room-1:',
      {
        x: roomX,
        y: roomY,
        width: OPTION_ROOM_WIDTH_PX,
        height: OPTION_ROOM_HEIGHT_PX,
      },
    );

    OPTION_ROOM_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer =
          map.createLayer(
            layerName,
            tilesets,
            roomX,
            roomY,
          );

        if (!layer) {
          console.error(
            `[GrillingScene] Failed to create Room-1 layer: ${layerName}`,
          );

          return;
        }

        layer.setDepth(
          depth + 20,
        );

        if (
          layerName ===
          OPTION_ROOM_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion(
            [-1],
          );

          this.physics.add.collider(
            this.player.sprite,
            layer,
          );
        }
      },
    );

    const roomBottom =
      roomY +
      OPTION_ROOM_HEIGHT_PX;

    const roomRight =
      roomX +
      OPTION_ROOM_WIDTH_PX;

    this.extendWorldBounds(
      roomX,
      roomY,
      roomRight,
      roomBottom,
    );

    this.worldBottomY =
      roomBottom;
  }

  private extendWorldBounds(
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): void {
    const currentBounds =
      this.cameras.main.getBounds();

    const minX =
      Math.min(
        currentBounds.x,
        left,
      );

    const minY =
      Math.min(
        currentBounds.y,
        top,
      );

    const maxX =
      Math.max(
        currentBounds.right,
        right,
      );

    const maxY =
      Math.max(
        currentBounds.bottom,
        bottom,
      );

    const width =
      maxX - minX;

    const height =
      maxY - minY;

    this.physics.world.setBounds(
      minX,
      minY,
      width,
      height,
    );

    this.cameras.main.setBounds(
      minX,
      minY,
      width,
      height,
    );
  }

  // ---------------------------------------------------------------------------
  // Build a decision room at an arbitrary Y offset
  // ---------------------------------------------------------------------------

  /**
   * Places a new decision room tilemap at
   * `offsetY` in world space and wires up
   * its wall collision with the player.
   *
   * Called for round 2, 3, … (round 1 is
   * set up by buildRoom() in create()).
   */
  private buildDecisionRoomAt(
    offsetY: number,
  ): void {
    const cached =
      this.cache.tilemap.get(
        DECISION_TILEMAP_KEY,
      );

    if (cached?.data) {
      patchDecisionRoomTilesets(
        cached.data,
      );
    }

    const map = this.make.tilemap({
      key: DECISION_TILEMAP_KEY,
    });

    const tilesets =
      DECISION_TILESETS
        .map((tileset) =>
          map.addTilesetImage(
            tileset.name,
            tileset.key,
          ),
        )
        .filter(
          (
            tileset,
          ): tileset is Phaser.Tilemaps.Tileset =>
            tileset !== null,
        );

    DECISION_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer =
          map.createLayer(
            layerName,
            tilesets,
            0,
            offsetY,
          );

        layer?.setDepth(depth);

        if (
          layerName ===
          DECISION_COLLIDABLE_LAYER
        ) {
          layer?.setCollisionByExclusion(
            [-1],
          );

          if (layer) {
            this.physics.add.collider(
              this.player.sprite,
              layer,
            );
          }
        }
      },
    );
  }

  // ---------------------------------------------------------------------------
  // React communication
  // ---------------------------------------------------------------------------

  private emitUI(
    event: Parameters<typeof emitUIEvent>[1],
  ): void {
    emitUIEvent(
      this.game,
      event,
    );
  }

  // ---------------------------------------------------------------------------
  // Restore state after reload
  // ---------------------------------------------------------------------------

  private restoreCurrentPhase(): void {
    const decision =
      this.store.getCurrentDecision();

    if (!decision) {
      return;
    }

    if (
      decision.selectedOptionId &&
      !decision.challenge
    ) {
      this.phase =
        GamePhase.WAITING_FOR_CHALLENGE;

      this.player.stop();

      this.emitUI({
        type: 'WAITING',
        message:
          'Waiting for the challenge...',
      });

      return;
    }

    if (
      decision.challenge &&
      !decision.defense
    ) {
      this.phase =
        GamePhase.RESPONDING_TO_CHALLENGE;

      this.player.stop();

      this.emitUI({
        type: 'CHALLENGE',
        question:
          decision.challenge,
      });

      return;
    }

    if (
      decision.defense &&
      !decision.feedback
    ) {
      this.phase =
        GamePhase.WAITING_FOR_EVALUATION;

      this.player.stop();

      this.emitUI({
        type: 'WAITING',
        message:
          'Waiting for evaluation...',
      });

      return;
    }

    if (decision.feedback) {
      this.phase =
        GamePhase.SHOWING_EVALUATION;

      this.player.stop();

      this.emitUI({
        type: 'EVALUATION',
        feedback:
          decision.feedback,
        consequence:
          decision.consequence ?? '',
      });

      return;
    }

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type: 'EXPLORING_DOORS',
    });
  }

  // ---------------------------------------------------------------------------
  // Room building
  // ---------------------------------------------------------------------------

  private buildRoom(): void {
    const cached =
      this.cache.tilemap.get(
        DECISION_TILEMAP_KEY,
      );

    if (cached?.data) {
      patchDecisionRoomTilesets(
        cached.data,
      );
    }

    this.map =
      this.make.tilemap({
        key: DECISION_TILEMAP_KEY,
      });

    const tilesets =
      DECISION_TILESETS
        .map((tileset) =>
          this.map.addTilesetImage(
            tileset.name,
            tileset.key,
          ),
        )
        .filter(
          (
            tileset,
          ): tileset is Phaser.Tilemaps.Tileset =>
            tileset !== null,
        );

    DECISION_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer =
          this.map.createLayer(
            layerName,
            tilesets,
          );

        layer?.setDepth(depth);

        if (
          layerName ===
          DECISION_COLLIDABLE_LAYER
        ) {
          layer?.setCollisionByExclusion(
            [-1],
          );

          this.wallsLayer =
            layer ?? undefined;

          if (layer) {
            this.physics.add.collider(
              this.player.sprite,
              layer,
            );
          }
        }
      },
    );

    // -----------------------------------------------------------------------
    // World bounds
    // -----------------------------------------------------------------------

    const {
      minTileX,
      maxTileX,
      minTileY,
      maxTileY,
    } = DECISION_MAP_BOUNDS;

    const boundsX =
      minTileX *
      DECISION_MAP_TILE_SIZE;

    const boundsY =
      minTileY *
      DECISION_MAP_TILE_SIZE;

    const boundsWidthPx =
      (maxTileX -
        minTileX +
        1) *
      DECISION_MAP_TILE_SIZE;

    const boundsHeightPx =
      (maxTileY -
        minTileY +
        1) *
      DECISION_MAP_TILE_SIZE;

    this.physics.world.setBounds(
      boundsX,
      boundsY,
      boundsWidthPx,
      boundsHeightPx,
    );

    this.cameras.main.setBounds(
      boundsX,
      boundsY,
      boundsWidthPx,
      boundsHeightPx,
    );

    // Track where the next segment
    // should start in world space.
    this.decisionRoomOffsetY =
      boundsY;

    this.worldBottomY =
      boundsY + boundsHeightPx;
  }

  // ---------------------------------------------------------------------------
  // Decision rendering
  // ---------------------------------------------------------------------------

  private renderDecision(
    decision: DecisionCreatedMsg,
  ): void {
    this.clearDecision();

    this.currentNodeId =
      decision.nodeId;

    this.emitUI({
      type: 'DECISION',
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

    const options =
      decision.options;

    const rangeStartPx =
      DECISION_DOOR_ROW_X_RANGE.minTileX *
      DECISION_MAP_TILE_SIZE;

    const rangeWidthPx =
      (
        DECISION_DOOR_ROW_X_RANGE.maxTileX -
        DECISION_DOOR_ROW_X_RANGE.minTileX +
        1
      ) *
      DECISION_MAP_TILE_SIZE;

    const spacing =
      options.length > 0
        ? Math.min(
            120,
            rangeWidthPx /
              (options.length + 1),
          )
        : 120;

    // Door Y is relative to wherever the
    // current decision room tilemap was
    // placed (changes each round).
    const doorY =
      this.decisionRoomOffsetY +
      DECISION_DOOR_ROW_TILE_Y *
        DECISION_MAP_TILE_SIZE +
      DECISION_MAP_TILE_SIZE / 2;

    options.forEach(
      (option, index) => {
        const doorX =
          rangeStartPx +
          spacing *
            (index + 1);

        const isRecommended =
          decision.recommendation
            ?.option ===
          option.id;

        const doorSprite =
          this.add
            .image(
              doorX,
              doorY,
              'door-closed',
            )
            .setOrigin(
              0.5,
              1.42,
            )
            .setDepth(5)
            .setScale(
              DOOR_SCALE,
            );

        this.doors.push({
          option,
          x: doorX,
          y: doorY,
          doorSprite,
          isRecommended,
          isOpen: false,
        });
      },
    );

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type:
        'EXPLORING_DOORS',
    });
  }

  // ---------------------------------------------------------------------------
  // Clear previous decision
  // ---------------------------------------------------------------------------

  private clearDecision(): void {
    this.doors.forEach(
      (door) => {
        door.doorSprite.destroy();
      },
    );

    this.doors = [];

    this.currentDoor =
      undefined;
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

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
  
    // TEMPORARY DEBUG
    this.cameras.main.stopFollow();
  
    this.cameras.main.setZoom(0.5);
  
    this.cameras.main.centerOn(
      350,
      800,
    );
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  private setupInput(): void {
    this.cursors =
      this.input.keyboard!
        .createCursorKeys();

    this.interactKey =
      this.input.keyboard!.addKey(
        Phaser.Input.Keyboard.KeyCodes.E,
      );
  }

  // ---------------------------------------------------------------------------
  // Door proximity
  // ---------------------------------------------------------------------------

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
        minDist =
          distance;

        nearest = door;
      }
    }

    if (
      nearest &&
      nearest !==
        this.currentDoor
    ) {
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

  // ---------------------------------------------------------------------------
  // Door prompt
  // ---------------------------------------------------------------------------

  private showDoorPrompt(
    door: DoorObject,
  ): void {
    door.doorSprite.setTint(
      0xffaa44,
    );

    this.emitUI({
      type:
        'DOOR_PROXIMITY',
      visible: true,
      option:
        door.option,
    });
  }

  private hideDoorPrompt(): void {
    this.doors.forEach(
      (door) => {
        door.doorSprite.clearTint();
      },
    );

    this.emitUI({
      type:
        'DOOR_PROXIMITY',
      visible: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Enter door
  // ---------------------------------------------------------------------------

  private approachDoor(
    door: DoorObject,
  ): void {
    this.phase =
      GamePhase.DOOR_CONTEXT;

    this.currentDoor =
      door;

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

    this.emitUI({
      type:
        'DOOR_CONTEXT',
      visible: true,
      option:
        door.option,
    });
  }

  // ---------------------------------------------------------------------------
  // Select door
  // ---------------------------------------------------------------------------

  public confirmDoorSelection(
    context?: string,
  ): void {
    if (!this.currentDoor) {
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

    this.phase =
      GamePhase.EXPLORING_DOORS;

    this.currentDoor =
      undefined;

    this.emitUI({
      type:
        'DOOR_CONTEXT',
      visible: false,
    });
  }

  private selectDoor(
    door: DoorObject,
    context?: string,
  ): void {
    this.phase =
      GamePhase.TRAVERSING_OPTION;

    this.currentDoor =
      door;

    // Generate the selected branch only.
    this.createCorridor(
      door,
    );

    this.store.updateCurrent({
      selectedOptionId:
        door.option.id,
      context,
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

    // No WAITING overlay here —
    // the corridor walk IS the loading
    // experience. The challenge panel will
    // appear when the AI responds.
  }

  // ---------------------------------------------------------------------------
  // Challenge response
  // ---------------------------------------------------------------------------

  public submitDefense(
    defense: string,
  ): void {
    const trimmed =
      defense.trim();

    if (!trimmed) {
      return;
    }

    const decision =
      this.store.getCurrentDecision();

    if (!decision) {
      return;
    }

    this.phase =
      GamePhase.WAITING_FOR_EVALUATION;

    this.player.stop();

    this.store.updateCurrent({
      defense: trimmed,
    });

    this.emitUI({
      type: 'WAITING',
      message:
        'Waiting for evaluation...',
    });

    this.ws.send({
      type:
        'CHALLENGE_RESPONSE',
      nodeId:
        this.currentNodeId,
      response:
        trimmed,
    });
  }

  // ---------------------------------------------------------------------------
  // Server messages
  // ---------------------------------------------------------------------------

  private handleMessage(
    msg: ServerMessage,
  ): void {
    switch (msg.type) {
      case 'CHALLENGE': {
        const challenge =
          msg as ChallengeMsg;

        this.store.updateCurrent({
          challenge:
            challenge.question,
        });

        this.phase =
          GamePhase.RESPONDING_TO_CHALLENGE;

        this.player.stop();

        this.emitUI({
          type: 'CHALLENGE',
          question:
            challenge.question,
        });

        break;
      }

      case 'EVALUATION': {
        const evaluation =
          msg as EvaluationMsg;

        this.store.updateCurrent({
          feedback:
            evaluation.feedback,
          consequence:
            evaluation.consequence,
        });

        this.phase =
          GamePhase.SHOWING_EVALUATION;

        this.player.stop();

        this.emitUI({
          type: 'EVALUATION',
          feedback:
            evaluation.feedback,
          consequence:
            evaluation.consequence,
        });

        break;
      }

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

        // -------------------------------------------------------
        // Extend the world downward with a new decision room.
        // -------------------------------------------------------

        const newRoomOffsetY =
          this.worldBottomY;

        this.buildDecisionRoomAt(
          newRoomOffsetY,
        );

        this.decisionRoomOffsetY =
          newRoomOffsetY;

        const decisionRoomHeightPx =
          (
            DECISION_MAP_BOUNDS.maxTileY -
            DECISION_MAP_BOUNDS.minTileY +
            1
          ) *
          DECISION_MAP_TILE_SIZE;

        this.worldBottomY +=
          decisionRoomHeightPx;

        // Expand camera / physics bounds.
        const bounds =
          this.cameras.main.getBounds();

        const newH = Math.max(
          bounds.height,
          this.worldBottomY -
            bounds.y,
        );

        this.physics.world.setBounds(
          bounds.x,
          bounds.y,
          bounds.width,
          newH,
        );

        this.cameras.main.setBounds(
          bounds.x,
          bounds.y,
          bounds.width,
          newH,
        );

        this.phase =
          GamePhase.EXPLORING_DOORS;

        // Clear the evaluation panel
        // immediately so the player can
        // see the world and start walking.
        this.emitUI({
          type: 'EXPLORING_DOORS',
        });

        // Render new doors after a short
        // delay so the camera has time
        // to show the new room.
        this.time.delayedCall(
          400,
          () => {
            this.clearDecision();

            this.renderDecision(
              decision,
            );
          },
        );

        break;
      }

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

      case 'SESSION_RESUMED': {
        this.emitUI({
          type:
            'SESSION_RESUMED',
        });

        break;
      }

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

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private leaveBoot(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs =
      undefined;
  }

  shutdown(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs =
      undefined;

    this.doors.forEach(
      (door) => {
        door.doorSprite.destroy();
      },
    );

    this.doors = [];

    this.currentDoor =
      undefined;
  }
} 