import Phaser from 'phaser';

import { Player } from '../entities/Player';

import {
  MAP_TILESETS,
  MAP_TILE_SIZE,
  COLLIDABLE_OBJECT_LAYERS,
  DECOR_OBJECT_LAYERS,
  SPAWN_TILE,
  GATE_TILE,
  TILEMAP_KEY,
} from '../tilemaps/commonRoomTilemap';

import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';

import type { ServerMessage, DecisionCreatedMsg } from '../net/protocol';

import { emitUI } from './support/sceneUi';

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;

  /**
   * True when the session was restored while
   * waiting for the first decision.
   */
  gateWaiting?: boolean;
}

// ─────────────────────────────────────────────
// Elevator
// ─────────────────────────────────────────────

const ELEVATOR_KEY = 'elevator';

/**
 * Elevator spritesheet:
 *
 * Frame 0 → doors closed
 * Frame 1 → doors opening
 * Frame 2 → doors open
 */
const ELEVATOR_SCALE = 0.35;

/**
 * Delay between elevator frames.
 */
const ELEVATOR_FRAME_DELAY = 150;

export class CommonRoomScene extends Phaser.Scene {
  private player!: Player;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private ws!: WebSocketClient;
  private store!: SessionStore;
  private unsubscribeWs?: () => void;
  private elevator?: Phaser.GameObjects.Sprite;
  private elevatorAnimating = false;
  private elevatorInteractionX = 0;
  private elevatorInteractionY = 0;
  private gateOpen = false;
  private gateWaiting = false;
  private gateSubmitted = false;
  private nearGate = false;
  private gateX = 0;
  private gateY = 0;

  constructor() {
    super({
      key: 'CommonRoomScene',
    });
  }

  // ─────────────────────────────────────────────
  // Scene initialization
  // ─────────────────────────────────────────────

  init(data: SceneData): void {
    this.ws = data.ws;
    this.store = data.store;
    this.gateWaiting = data.gateWaiting ?? false;
    this.gateOpen = false;
    this.gateSubmitted = false;
    this.elevatorAnimating = false;
    this.nearGate = false;
  }

  // ─────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────

  create(): void {
    this.walls = this.physics.add.staticGroup();
    this.buildRoom();
    this.createPlayer();
    this.physics.add.collider(this.player.sprite, this.walls);

    if (this.groundLayer) {
      this.physics.add.collider(this.player.sprite, this.groundLayer);
    }

    this.setupInput();
    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));

    /**
     * Tell React that the common room
     * has been loaded.
     */
    emitUI(this, {
      type: 'COMMON_ROOM_READY',
    });

    /**
     * If the session was restored while
     * waiting for the first decision,
     * reopen the React elevator UI.
     */
    if (this.gateWaiting) {
      this.openGateWaiting();
    }
  }

  // ─────────────────────────────────────────────
  // Game loop
  // ─────────────────────────────────────────────

  update(): void {
    /**
     * Stop player movement while the
     * React elevator UI is open.
     */
    if (this.gateOpen) {
      this.player.stop();

      /**
       * Escape closes the React modal
       * unless we're waiting for the server.
       */
      if (!this.gateWaiting && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
        this.closeGate();
      }

      return;
    }

    this.player.handleMovement(this.cursors);

    this.checkGateProximity();
  }

  // ─────────────────────────────────────────────
  // Room
  // ─────────────────────────────────────────────

  private buildRoom(): void {
    this.map = this.make.tilemap({
      key: TILEMAP_KEY,
    });

    const tilesets = MAP_TILESETS.map((tileset) =>
      this.map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    // ─────────────────────────────────────────
    // Ground
    // ─────────────────────────────────────────

    this.groundLayer = this.map.createLayer('Ground', tilesets, 0, 0) ?? undefined;

    this.groundLayer?.setDepth(0);

    /**
     * Ground tiles with the `collides`
     * property block the player.
     */
    this.groundLayer?.setCollisionByProperty({
      collides: true,
    });

    // ─────────────────────────────────────────
    // Collidable objects
    // ─────────────────────────────────────────

    for (const layerName of COLLIDABLE_OBJECT_LAYERS) {
      const objects = this.map.createFromObjects(layerName, {
        classType: Phaser.GameObjects.Image,
      }) as Phaser.GameObjects.Image[];

      objects.forEach((object) => {
        this.physics.add.existing(object, true);

        object.setDepth(5);

        this.walls.add(object);
      });
    }

    // ─────────────────────────────────────────
    // Decorative objects
    // ─────────────────────────────────────────

    for (const layerName of DECOR_OBJECT_LAYERS) {
      const objects = this.map.createFromObjects(layerName, {
        classType: Phaser.GameObjects.Image,
      }) as Phaser.GameObjects.Image[];

      objects.forEach((object) => {
        object.setDepth(4);
      });
    }

    // ─────────────────────────────────────────
    // World bounds
    // ─────────────────────────────────────────

    const mapWidthPx = this.map.widthInPixels;

    const mapHeightPx = this.map.heightInPixels;

    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);

    this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);

    // ─────────────────────────────────────────
    // Elevator
    // ─────────────────────────────────────────

    this.gateX = GATE_TILE.x * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    this.gateY = GATE_TILE.y * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    this.elevatorInteractionX = this.gateX;

    this.elevatorInteractionY = this.gateY + MAP_TILE_SIZE * 2;

    /**
     * Frame 0 = elevator closed.
     */
    this.elevator = this.add
      .sprite(this.gateX, this.gateY + MAP_TILE_SIZE / 2, ELEVATOR_KEY, 0)
      .setOrigin(0.5, 1)
      .setScale(ELEVATOR_SCALE)
      .setDepth(10);

    /**
     * Invisible collision area at
     * the bottom of the elevator.
     */
    const elevatorCollider = this.add.rectangle(this.gateX, this.gateY - 10, 105, 110, 0xffffff, 0);

    this.physics.add.existing(elevatorCollider, true);

    this.walls.add(elevatorCollider);
  }

  // ─────────────────────────────────────────────
  // Elevator animation
  // ─────────────────────────────────────────────

  private playElevatorAnimation(): void {
    if (!this.elevator || this.elevatorAnimating) {
      return;
    }

    this.elevatorAnimating = true;

    /**
     * Frame 0
     *
     * Closed.
     */
    this.elevator.setFrame(0);

    /**
     * Frame 1
     *
     * Opening.
     */
    this.time.delayedCall(ELEVATOR_FRAME_DELAY, () => {
      if (!this.elevator) {
        return;
      }

      this.elevator.setFrame(1);
    });

    /**
     * Frame 2
     *
     * Fully open.
     */
    this.time.delayedCall(ELEVATOR_FRAME_DELAY * 2, () => {
      if (!this.elevator) {
        return;
      }

      this.elevator.setFrame(2);
    });

    /**
     * Animation complete.
     */
    this.time.delayedCall(ELEVATOR_FRAME_DELAY * 3, () => {
      this.elevatorAnimating = false;
    });
  }

  // ─────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────

  private createPlayer(): void {
    const spawnX = SPAWN_TILE.x * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    const spawnY = SPAWN_TILE.y * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    this.player = new Player(this, spawnX, spawnY);

    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
  }

  // ─────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  // ─────────────────────────────────────────────
  // Elevator proximity
  // ─────────────────────────────────────────────

  private checkGateProximity(): void {
    const distance = Phaser.Math.Distance.Between(
      this.player.sprite.x,
      this.player.sprite.y,
      this.elevatorInteractionX,
      this.elevatorInteractionY,
    );

    if (distance < MAP_TILE_SIZE * 3) {
      if (!this.nearGate) {
        this.nearGate = true;

        /**
         * React displays:
         *
         * "Press E to enter elevator"
         */
        emitUI(this, {
          type: 'ELEVATOR_PROXIMITY',
          visible: true,
        });
      }

      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.openGate();
      }
    } else if (this.nearGate) {
      this.nearGate = false;

      emitUI(this, {
        type: 'ELEVATOR_PROXIMITY',
        visible: false,
      });
    }
  }

  // ─────────────────────────────────────────────
  // Open elevator
  // ─────────────────────────────────────────────

  private openGate(): void {
    if (this.gateOpen) {
      return;
    }

    this.gateOpen = true;

    this.nearGate = false;

    emitUI(this, {
      type: 'ELEVATOR_PROXIMITY',
      visible: false,
    });

    /**
     * Play elevator opening animation.
     */
    this.playElevatorAnimation();

    /**
     * React now displays the problem
     * statement modal.
     */
    emitUI(this, {
      type: 'ELEVATOR_OPEN',
      waiting: false,
    });
  }

  // ─────────────────────────────────────────────
  // Restore waiting state
  // ─────────────────────────────────────────────

  private openGateWaiting(): void {
    if (this.gateOpen) {
      return;
    }

    this.gateOpen = true;

    this.nearGate = false;

    /**
     * Show elevator fully open.
     */
    if (this.elevator) {
      this.elevator.setFrame(2);
    }

    /**
     * React owns the waiting UI.
     */
    emitUI(this, {
      type: 'ELEVATOR_OPEN',
      waiting: true,
      message: 'Waiting for the next decision...',
    });
  }

  // ─────────────────────────────────────────────
  // Problem submission
  // ─────────────────────────────────────────────

  /**
   * Called by React when the user submits
   * the problem statement.
   */
  public submitProblem(problem: string): void {
    if (this.gateSubmitted) {
      return;
    }

    const trimmed = problem.trim();

    if (!trimmed) {
      return;
    }

    this.gateSubmitted = true;

    this.store.setProblem(trimmed);

    this.gateWaiting = true;

    /**
     * React switches the modal into
     * its loading/waiting state.
     */
    emitUI(this, {
      type: 'ELEVATOR_SUBMITTING',
      message: 'Entering the elevator...',
    });

    /**
     * Existing backend protocol.
     */
    this.ws.send({
      type: 'PROBLEM_SUBMITTED',
      problem: trimmed,
    });
  }

  // ─────────────────────────────────────────────
  // Close elevator
  // ─────────────────────────────────────────────

  /**
   * Called by React or Escape.
   */
  public closeGate(): void {
    if (this.gateWaiting) {
      return;
    }

    this.gateOpen = false;
    this.gateWaiting = false;
    this.gateSubmitted = false;

    this.elevator?.setFrame(0);

    this.elevatorAnimating = false;

    emitUI(this, {
      type: 'ELEVATOR_CLOSED',
    });
  }

  // ─────────────────────────────────────────────
  // WebSocket messages
  // ─────────────────────────────────────────────

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      // ───────────────────────────────────────
      // Session started
      // ───────────────────────────────────────

      case 'SESSION_STARTED': {
        this.ws.setSessionId(msg.sessionId);

        this.store.setSession(msg.sessionId);

        emitUI(this, {
          type: 'SESSION_STARTED',
          sessionId: msg.sessionId,
        });

        break;
      }

      // ───────────────────────────────────────
      // Session resumed
      // ───────────────────────────────────────

      case 'SESSION_RESUMED': {
        this.ws.setSessionId(msg.sessionId);

        this.store.hydrate(msg.snapshot);

        emitUI(this, {
          type: 'SESSION_RESUMED',
        });

        break;
      }

      // ───────────────────────────────────────
      // Decision created
      // ───────────────────────────────────────

      case 'DECISION_CREATED': {
        const decision = msg as DecisionCreatedMsg;

        this.store.addDecision({
          nodeId: decision.nodeId,
          question: decision.question,
          description: decision.description,
          options: decision.options,
          recommendation: decision.recommendation,
          round: decision.round,
        });

        this.gateOpen = false;
        this.gateWaiting = false;
        this.gateSubmitted = false;

        this.elevator?.setFrame(0);
        this.elevatorAnimating = false;

        emitUI(this, {
          type: 'ELEVATOR_CLOSED',
        });

        this.unsubscribeWs?.();
        this.unsubscribeWs = undefined;

        this.scene.start('GrillingScene', {
          ws: this.ws,
          store: this.store,
          decision,
          restored: false,
        });

        break;
      }

      // ───────────────────────────────────────
      // Error
      // ───────────────────────────────────────

      case 'ERROR': {
        console.error('Server error:', msg.message);

        this.gateSubmitted = false;

        this.gateWaiting = false;

        /**
         * Keep the elevator modal open
         * and let React display the error.
         */
        emitUI(this, {
          type: 'ERROR',
          message: msg.message,
        });

        break;
      }

      // ───────────────────────────────────────

      default:
        break;
    }
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  shutdown(): void {
    this.unsubscribeWs?.();
    this.unsubscribeWs = undefined;
    this.elevator = undefined;
    this.player?.stop();
    this.gateOpen = false;
    this.gateWaiting = false;
    this.gateSubmitted = false;
    this.nearGate = false;
  }
}
