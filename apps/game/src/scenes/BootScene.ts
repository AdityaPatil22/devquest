import Phaser from 'phaser';

import { TILEMAP_KEY, TILEMAP_PATH, MAP_TILESETS } from '../tilemaps/commonRoomTilemap';
import { GameWorldScene } from './GameWorldScene';

import {
  DECISION_TILEMAP_KEY,
  DECISION_TILEMAP_PATH,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
} from '../tilemaps/decisionRoomTilemap';

import {
  TROPHY_TILEMAP_KEY,
  TROPHY_TILEMAP_PATH,
  TROPHY_TILESETS,
  TROPHY_MAP_TILE_SIZE,
} from '../tilemaps/trophyRoomTilemap';

import { Player } from '../entities/Player';

import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';

import type { ServerMessage, SessionResumedMsg, DecisionCreatedMsg } from '../net/protocol';

import { emitUIEvent } from '../game/GameBridge';

const CONTINUOUS_WORLD_MAPS = [
  ['corridor-map', 'assets/map/corridor/corridor.json'],
  ['room-1', 'assets/map/randomrooms/room-1.json'],
  ['room-2', 'assets/map/randomrooms/room-2.json'],
  ['room-3', 'assets/map/randomrooms/room-3.json'],
  ['room-4', 'assets/map/randomrooms/room-4.json'],
] as const;


export class BootScene extends Phaser.Scene {
  // ─────────────────────────────────────────────
  // Network / state
  // ─────────────────────────────────────────────

  private ws!: WebSocketClient;

  private store!: SessionStore;

  private unsubscribeWs?: () => void;

  private restoring = false;

  constructor() {
    super({
      key: 'BootScene',
    });
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  private leaveBoot(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs = undefined;
  }

  // ─────────────────────────────────────────────
  // React bridge
  // ─────────────────────────────────────────────

  /**
   * Send non-game UI events to React.
   *
   * Phaser should not create any loading
   * screen, text, progress bar, etc.
   */
  private emitUI(event: Parameters<typeof emitUIEvent>[1]): void {
    emitUIEvent(this.game, event);
  }

  // ─────────────────────────────────────────────
  // Preload
  // ─────────────────────────────────────────────

  preload(): void {
    /**
     * Tell React that Phaser has started
     * loading the game assets.
     */
    this.emitUI({
      type: 'GAME_LOADING',
      loading: true,
      progress: 0,
    });

    // ─────────────────────────────────────────
    // Elevator
    // ─────────────────────────────────────────

    this.load.spritesheet('elevator', 'assets/items/elevator.png', {
      frameWidth: 280,
      frameHeight: 285,
    });

    // ─────────────────────────────────────────
    // Common Room
    // ─────────────────────────────────────────

    this.load.tilemapTiledJSON(TILEMAP_KEY, TILEMAP_PATH);

    MAP_TILESETS.forEach(({ key, path, frameWidth, frameHeight }) => {
      this.load.spritesheet(key, path, {
        frameWidth,
        frameHeight,
        margin: 0,
        spacing: 0,
      });
    });

    // ─────────────────────────────────────────
    // Decision Room
    // ─────────────────────────────────────────

    this.load.tilemapTiledJSON(DECISION_TILEMAP_KEY, DECISION_TILEMAP_PATH);

    const seenKeys = new Set<string>();

    DECISION_TILESETS.forEach(({ key, path }) => {
      /**
       * Some decision-room tilesets
       * can reference the same asset more
       * than once.
       */
      if (seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);

      this.load.spritesheet(key, path, {
        frameWidth: DECISION_MAP_TILE_SIZE,

        frameHeight: DECISION_MAP_TILE_SIZE,

        margin: 0,

        spacing: 0,
      });
    });

    // ─────────────────────────────────────────
    // Continuous world areas
    // ─────────────────────────────────────────

    CONTINUOUS_WORLD_MAPS.forEach(([key, path]) => {
      this.load.tilemapTiledJSON(key, path);
    });

    // ─────────────────────────────────────────
    // Trophy Room
    // ─────────────────────────────────────────

    this.load.image('trophy', 'assets/items/trophy.png');

    this.load.tilemapTiledJSON(TROPHY_TILEMAP_KEY, TROPHY_TILEMAP_PATH);

    const trophySeenKeys = new Set<string>();

    TROPHY_TILESETS.forEach(({ key, path }) => {
      if (trophySeenKeys.has(key)) {
        return;
      }

      trophySeenKeys.add(key);

      this.load.spritesheet(key, path, {
        frameWidth: TROPHY_MAP_TILE_SIZE,
        frameHeight: TROPHY_MAP_TILE_SIZE,
        margin: 0,
        spacing: 0,
      });
    });

    // ─────────────────────────────────────────
    // Player
    // ─────────────────────────────────────────

    Player.preload(this);

    // ─────────────────────────────────────────
    // Loading progress
    // ─────────────────────────────────────────

    this.load.on('progress', (value: number) => {
      this.emitUI({
        type: 'GAME_LOADING',
        loading: true,
        progress: value,
      });
    });

    this.load.once('complete', () => {
      this.emitUI({
        type: 'GAME_LOADING',
        loading: false,
        progress: 1,
      });
    });
  }

  // ─────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────

  create(): void {
    // ─────────────────────────────────────────
    // Player animations
    // ─────────────────────────────────────────

    Player.createAnimations(this);

    // ─────────────────────────────────────────
    // Elevator animation
    // ─────────────────────────────────────────

    this.anims.create({
      key: 'elevator-opening',

      frames: this.anims.generateFrameNumbers('elevator', {
        start: 0,
        end: 2,
      }),

      frameRate: 6,

      repeat: 0,
    });

    // ─────────────────────────────────────────
    // Session state
    // ─────────────────────────────────────────

    this.store = new SessionStore();

    // ─────────────────────────────────────────
    // WebSocket
    // ─────────────────────────────────────────

    this.ws = new WebSocketClient();

    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));

    /**
     * Tell React that the game engine
     * is ready to establish the session.
     */
    this.emitUI({
      type: 'GAME_READY',
    });

    /**
     * BootScene owns the initial WebSocket.
     *
     * If sessionStorage contains a session ID,
     * WebSocketClient reconnects to it.
     *
     * Otherwise the server creates a new session.
     */
    this.ws.connect();
  }

  // ─────────────────────────────────────────────
  // WebSocket messages
  // ─────────────────────────────────────────────

  private handleMessage(msg: ServerMessage): void {
    // ─────────────────────────────────────────
    // New session
    // ─────────────────────────────────────────

    if (msg.type === 'SESSION_STARTED') {
      this.ws.setSessionId(msg.sessionId);

      this.store.setSession(msg.sessionId);

      this.restoring = false;

      this.emitUI({
        type: 'SESSION_STARTED',
        sessionId: msg.sessionId,
      });

      this.leaveBoot();

      /**
       * New sessions always start
       * in the Common Room.
       */
      this.scene.start('GameWorldScene', {
        ws: this.ws,
        store: this.store,
      });

      return;
    }

    // ─────────────────────────────────────────
    // Existing session
    // ─────────────────────────────────────────

    if (msg.type === 'SESSION_RESUMED') {
      this.restoreSession(msg);

      return;
    }

    // ─────────────────────────────────────────
    // Decision fallback
    // ─────────────────────────────────────────

    /**
     * Normally DECISION_CREATED is handled
     * by the active scene.
     *
     * This fallback handles a decision that
     * arrives immediately after BootScene
     * reconnects.
     */
    if (msg.type === 'DECISION_CREATED') {
      this.restoreDecision(msg);
    }
  }

  // ─────────────────────────────────────────────
  // Restore session
  // ─────────────────────────────────────────────

  private restoreSession(msg: SessionResumedMsg): void {
    /**
     * Prevent duplicate SESSION_RESUMED
     * processing.
     */
    if (this.restoring) {
      return;
    }

    this.restoring = true;

    this.ws.setSessionId(msg.sessionId);

    this.store.hydrate(msg.snapshot);

    this.emitUI({
      type: 'SESSION_RESUMED',
      sessionId: msg.sessionId,
    });

    const phase = msg.snapshot.phase;

    // ─────────────────────────────────────────
    // No problem submitted
    // ─────────────────────────────────────────

    if (phase === 'idle' || phase === 'awaiting_problem') {
      this.leaveBoot();

      this.scene.start('CommonRoomScene', {
        ws: this.ws,
        store: this.store,
      });

      return;
    }

    // ─────────────────────────────────────────
    // Waiting for first question
    // ─────────────────────────────────────────

    if (phase === 'awaiting_question') {
      this.leaveBoot();

      this.scene.start('CommonRoomScene', {
        ws: this.ws,
        store: this.store,

        /**
         * CommonRoomScene will tell
         * React to display the waiting
         * elevator UI.
         */
        gateWaiting: true,
      });

      return;
    }

    // ─────────────────────────────────────────
    // Session complete
    // ─────────────────────────────────────────

    if (phase === 'complete') {
      this.leaveBoot();

      this.scene.start('TrophyScene', {
        store: this.store,
      });

      return;
    }

    // ─────────────────────────────────────────
    // Active decision
    // ─────────────────────────────────────────

    const currentDecision = this.store.getCurrentDecision();

    /**
     * If the server says we're in an active
     * phase but there is no decision available,
     * safely return to Common Room.
     */
    if (!currentDecision) {
      this.leaveBoot();

      this.scene.start('CommonRoomScene', {
        ws: this.ws,
        store: this.store,
      });

      return;
    }

    // ─────────────────────────────────────────
    // Reconstruct DecisionCreatedMsg
    // ─────────────────────────────────────────

    const decision: DecisionCreatedMsg = {
      type: 'DECISION_CREATED',

      nodeId: currentDecision.nodeId,

      question: currentDecision.question,

      options: currentDecision.options,

      recommendation: currentDecision.recommendation,

      round: currentDecision.round,

      dependsOn: msg.snapshot.decisions.find((item) => item.id === currentDecision.nodeId)
        ?.dependsOn,
    };

    this.leaveBoot();

    this.scene.start('GameWorldScene', {
      ws: this.ws,
      store: this.store,
      decision,
      restored: true,
    });
  }

  // ─────────────────────────────────────────────
  // Restore decision
  // ─────────────────────────────────────────────

  private restoreDecision(decision: DecisionCreatedMsg): void {
    this.store.addDecision({
      nodeId: decision.nodeId,

      question: decision.question,

      options: decision.options,

      recommendation: decision.recommendation,

      round: decision.round,
    });

    this.leaveBoot();

    this.scene.start('DecisionRoomScene', {
      ws: this.ws,
      store: this.store,
      decision,
    });
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  shutdown(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs = undefined;
  }
}
