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
}

/**
 * Decision Room
 *
 * Phaser responsibilities:
 * - Render the Tiled map
 * - Render doors
 * - Render/move player
 * - Detect door proximity
 * - Handle keyboard interaction
 * - Manage collisions
 * - Communicate with backend
 *
 * React responsibilities:
 * - Question UI
 * - Recommendation UI
 * - Door context modal
 * - Challenge UI
 * - Defense input
 * - Waiting states
 * - Evaluation UI
 * - Error UI
 * - Completion UI
 */
const DOOR_SCALE = 0.191;
const DOOR_OPEN_SCALE = 0.191;

export class DecisionRoomScene extends Phaser.Scene {
  private player!: Player;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private interactKey!: Phaser.Input.Keyboard.Key;

  private ws!: WebSocketClient;

  private store!: SessionStore;

  private map!: Phaser.Tilemaps.Tilemap;

  private wallsLayer?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;

  private doors: DoorObject[] = [];

  private phase = GamePhase.EXPLORING_DOORS;

  private currentDoor?: DoorObject;

  private currentNodeId = '';

  private unsubscribeWs?: () => void;

  constructor() {
    super({
      key: 'DecisionRoomScene',
    });
  }

  // ---------------------------------------------------------------------------
  // Phaser assets
  // ---------------------------------------------------------------------------

  preload(): void {
    this.load.image('door-closed', 'assets/items/door-closed.png');

    this.load.image('door-open', 'assets/items/door-open.png');
  }

  // ---------------------------------------------------------------------------
  // Scene initialization
  // ---------------------------------------------------------------------------

  init(data: SceneData): void {
    this.ws = data.ws;

    this.store = data.store;

    this.phase = GamePhase.EXPLORING_DOORS;

    this.currentDoor = undefined;

    this.doors = [];

    this.currentNodeId = data.decision.nodeId;

    this.data.set('decision', data.decision);

    this.data.set('restored', data.restored ?? false);

    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Scene creation
  // ---------------------------------------------------------------------------

  create(): void {
    this.buildRoom();

    this.createPlayer();

    this.setupInput();

    if (this.wallsLayer) {
      this.physics.add.collider(this.player.sprite, this.wallsLayer);
    }

    const decision = this.data.get('decision') as DecisionCreatedMsg;

    this.renderDecision(decision);

    const restored = this.data.get('restored') as boolean;

    if (restored) {
      this.restoreCurrentPhase();
    }

    // Tell React that the Decision Room is ready.
    this.emitUI({
      type: 'DECISION_ROOM_READY',
    });
  }

  // ---------------------------------------------------------------------------
  // Phaser game loop
  // ---------------------------------------------------------------------------

  update(): void {
    if (this.phase === GamePhase.EXPLORING_DOORS) {
      this.player.handleMovement(this.cursors);

      this.checkDoorProximity();
    } else {
      this.player.stop();
    }
  }

  // ---------------------------------------------------------------------------
  // React communication
  // ---------------------------------------------------------------------------

  private emitUI(event: Parameters<typeof emitUIEvent>[1]): void {
    emitUIEvent(this.game, event);
  }

  // ---------------------------------------------------------------------------
  // Restore state after reload
  // ---------------------------------------------------------------------------

  private restoreCurrentPhase(): void {
    const decision = this.store.getCurrentDecision();

    if (!decision) {
      return;
    }

    /**
     * Nothing selected.
     */
    this.phase = GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type: 'EXPLORING_DOORS',
    });
  }

  // ---------------------------------------------------------------------------
  // Room building
  // ---------------------------------------------------------------------------

  private buildRoom(): void {
    /**
     * Tiled references external TSX files.
     *
     * Patch them into the cached map before creating
     * the Phaser tilemap.
     */
    const cached = this.cache.tilemap.get(DECISION_TILEMAP_KEY);

    if (cached?.data) {
      patchDecisionRoomTilesets(cached.data);
    }

    this.map = this.make.tilemap({
      key: DECISION_TILEMAP_KEY,
    });

    const tilesets = DECISION_TILESETS.map((tileset) =>
      this.map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    DECISION_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = this.map.createLayer(layerName, tilesets);

      layer?.setDepth(depth);

      if (layerName === DECISION_COLLIDABLE_LAYER) {
        layer?.setCollisionByExclusion([-1]);

        this.wallsLayer = layer ?? undefined;
      }
    });

    const { minTileX, maxTileX, minTileY, maxTileY } = DECISION_MAP_BOUNDS;

    const boundsX = minTileX * DECISION_MAP_TILE_SIZE;

    const boundsY = minTileY * DECISION_MAP_TILE_SIZE;

    const boundsWidthPx = (maxTileX - minTileX + 1) * DECISION_MAP_TILE_SIZE;

    const boundsHeightPx = (maxTileY - minTileY + 1) * DECISION_MAP_TILE_SIZE;

    this.physics.world.setBounds(boundsX, boundsY, boundsWidthPx, boundsHeightPx);

    this.cameras.main.centerOn(boundsX + boundsWidthPx / 2, boundsY + boundsHeightPx / 2);
  }

  // ---------------------------------------------------------------------------
  // Decision rendering
  // ---------------------------------------------------------------------------

  private renderDecision(decision: DecisionCreatedMsg): void {
    this.clearDecision();

    this.currentNodeId = decision.nodeId;

    /**
     * React owns the question and recommendation.
     *
     * Phaser only tells React what the current
     * decision is.
     */
    this.emitUI({
      type: 'DECISION',
      nodeId: decision.nodeId,
      question: decision.question,
      options: decision.options,
      recommendation: decision.recommendation,
      round: decision.round,
    });

    const options = decision.options;

    const rangeStartPx = DECISION_DOOR_ROW_X_RANGE.minTileX * DECISION_MAP_TILE_SIZE;

    const rangeWidthPx =
      (DECISION_DOOR_ROW_X_RANGE.maxTileX - DECISION_DOOR_ROW_X_RANGE.minTileX + 1) *
      DECISION_MAP_TILE_SIZE;

    const spacing = options.length > 0 ? Math.min(120, rangeWidthPx / (options.length + 1)) : 120;

    const doorY = DECISION_DOOR_ROW_TILE_Y * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;

    options.forEach((option, index) => {
      const doorX = rangeStartPx + spacing * (index + 1);

      const isRecommended = decision.recommendation?.option === option.id;

      const doorSprite = this.add
        .image(doorX, doorY, 'door-closed')
        .setOrigin(0.5, 1.42)
        .setDepth(5)
        .setScale(DOOR_SCALE);

      this.doors.push({
        option,
        x: doorX,
        y: doorY,
        doorSprite,
        isRecommended,
        isOpen: false,
      });
    });

    this.phase = GamePhase.EXPLORING_DOORS;

    this.emitUI({
      type: 'EXPLORING_DOORS',
    });
  }

  // ---------------------------------------------------------------------------
  // Clear previous decision
  // ---------------------------------------------------------------------------

  private clearDecision(): void {
    this.doors.forEach((door) => {
      door.doorSprite.destroy();
    });

    this.doors = [];

    this.currentDoor = undefined;
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  private createPlayer(): void {
    const spawnX = DECISION_SPAWN_TILE.x * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;

    const spawnY = DECISION_SPAWN_TILE.y * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;

    this.player = new Player(this, spawnX, spawnY);
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  // ---------------------------------------------------------------------------
  // Door proximity
  // ---------------------------------------------------------------------------

  private checkDoorProximity(): void {
    let nearest: DoorObject | null = null;

    let minDist = Infinity;

    for (const door of this.doors) {
      const distance = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        door.x,
        door.y,
      );

      if (distance < 50 && distance < minDist) {
        minDist = distance;

        nearest = door;
      }
    }

    /**
     * Entering a door's proximity.
     */
    if (nearest && nearest !== this.currentDoor) {
      this.currentDoor = nearest;

      this.showDoorPrompt(nearest);
    }

    /**
     * Leaving door proximity.
     */
    else if (!nearest && this.currentDoor) {
      this.currentDoor = undefined;

      this.hideDoorPrompt();
    }

    /**
     * Press E.
     */
    if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.approachDoor(nearest);
    }
  }

  // ---------------------------------------------------------------------------
  // Door prompt
  // ---------------------------------------------------------------------------

  private showDoorPrompt(door: DoorObject): void {
    door.doorSprite.setTint(0xffaa44);

    /**
     * React renders the actual
     * interaction prompt.
     */
    this.emitUI({
      type: 'DOOR_PROXIMITY',
      visible: true,
      option: door.option,
    });
  }

  private hideDoorPrompt(): void {
    this.doors.forEach((door) => {
      door.doorSprite.clearTint();
    });

    this.emitUI({
      type: 'DOOR_PROXIMITY',
      visible: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Enter door
  // ---------------------------------------------------------------------------

  private approachDoor(door: DoorObject): void {
    this.phase = GamePhase.DOOR_CONTEXT;

    this.currentDoor = door;

    this.hideDoorPrompt();

    /**
     * Open the actual Phaser door.
     *
     * The modal itself is React.
     */
    if (!door.isOpen) {
      door.isOpen = true;

      door.doorSprite.setTexture('door-open').setOrigin(0.5, 1.32).setScale(DOOR_OPEN_SCALE);
    }

    this.emitUI({
      type: 'DOOR_CONTEXT',
      visible: true,
      option: door.option,
    });
  }

  // ---------------------------------------------------------------------------
  // Select door
  // ---------------------------------------------------------------------------

  /**
   * Called by React when the user confirms
   * the selected door/context.
   */
  public confirmDoorSelection(context?: string): void {
    if (!this.currentDoor) {
      return;
    }

    const door = this.currentDoor;

    this.selectDoor(door, context);
  }

  /**
   * Called by React when the user cancels
   * the door context modal.
   */
  public cancelDoorSelection(): void {
    if (this.phase !== GamePhase.DOOR_CONTEXT) {
      return;
    }

    if (this.currentDoor) {
      this.currentDoor.isOpen = false;

      this.currentDoor.doorSprite
        .setTexture('door-closed')
        .setOrigin(0.5, 1.42)
        .setScale(DOOR_SCALE);
    }

    this.phase = GamePhase.EXPLORING_DOORS;

    this.currentDoor = undefined;

    this.emitUI({
      type: 'DOOR_CONTEXT',
      visible: false,
    });
  }

  private selectDoor(door: DoorObject, context?: string): void {

    this.player.stop();

    this.emitUI({
      type: 'WAITING',
      message: 'Entering door...',
    });

    this.store.updateCurrent({
      selectedOptionId: door.option.id,
      context,
    });

    this.ws.send({
      type: 'OPTION_SELECTED',
      nodeId: this.currentNodeId,
      optionId: door.option.id,
      context,
    });
  }


  // ---------------------------------------------------------------------------
  // Server messages
  // ---------------------------------------------------------------------------

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      // -----------------------------------------------------------------------
      // Challenge
      // -----------------------------------------------------------------------



      // -----------------------------------------------------------------------
      // Next decision
      // -----------------------------------------------------------------------

      case 'DECISION_CREATED': {
        const decision = msg as DecisionCreatedMsg;

        this.store.addDecision({
          nodeId: decision.nodeId,
          question: decision.question,
          options: decision.options,
          recommendation: decision.recommendation,
          round: decision.round,
        });

        this.phase = GamePhase.EXPLORING_DOORS;

        /**
         * React can show a short transition
         * while Phaser prepares the next room.
         */
        this.emitUI({
          type: 'NEXT_DECISION_LOADING',
        });

        this.time.delayedCall(500, () => {
          this.clearDecision();

          this.renderDecision(decision);
        });
        break;
      }

      // -----------------------------------------------------------------------
      // Session complete
      // -----------------------------------------------------------------------

      case 'SESSION_COMPLETE': {
        const complete = msg as SessionCompleteMsg;

        this.store.complete(complete.summary, complete.docContent);

        this.player.stop();

        this.scene.start('TrophyScene', {
          store: this.store,
        });

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
      // Server error
      // -----------------------------------------------------------------------

      case 'ERROR': {
        console.error('Server error:', msg.message);

        this.emitUI({
          type: 'ERROR',
          message: msg.message,
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

    this.unsubscribeWs = undefined;
  }

  shutdown(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs = undefined;

    this.doors.forEach((door) => {
      door.doorSprite.destroy();
    });

    this.doors = [];

    this.currentDoor = undefined;
  }
}
