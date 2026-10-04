import Phaser from 'phaser';

import { TILEMAP_KEY, TILEMAP_PATH, MAP_TILESETS } from '../tilemaps/commonRoomTilemap';

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

import { CORRIDOR_TILEMAP_KEY, CORRIDOR_TILEMAP_PATH } from '../tilemaps/corridorTilemap';

import { OPTION_ROOM_TILEMAP_KEYS, OPTION_ROOM_TILEMAP_PATHS } from '../tilemaps/optionRoomTilemap';

import { Player } from '../entities/Player';

import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';

import type { ServerMessage, SessionResumedMsg, DecisionCreatedMsg } from '../net/protocol';

import { emitUI } from './support/sceneUi';

export class BootScene extends Phaser.Scene {
  private ws!: WebSocketClient;
  private store!: SessionStore;

  private unsubscribeWs?: () => void;

  private restoring = false;

  constructor() {
    super({
      key: 'BootScene',
    });
  }

  private leaveBoot(): void {
    this.unsubscribeWs?.();
    this.unsubscribeWs = undefined;
  }

  preload(): void {
    emitUI(this, {
      type: 'GAME_LOADING',
      loading: true,
      progress: 0,
    });

    // Elevator
    this.load.spritesheet('elevator', 'assets/items/elevator.png', {
      frameWidth: 280,
      frameHeight: 285,
    });

    // Common Room
    this.load.tilemapTiledJSON(TILEMAP_KEY, TILEMAP_PATH);

    MAP_TILESETS.forEach(({ key, path, frameWidth, frameHeight }) => {
      this.load.spritesheet(key, path, {
        frameWidth,
        frameHeight,
        margin: 0,
        spacing: 0,
      });
    });

    // Decision Room
    this.load.tilemapTiledJSON(DECISION_TILEMAP_KEY, DECISION_TILEMAP_PATH);

    const seenKeys = new Set<string>();

    DECISION_TILESETS.forEach(({ key, path }) => {
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

    // Corridor
    this.load.tilemapTiledJSON(CORRIDOR_TILEMAP_KEY, CORRIDOR_TILEMAP_PATH);

    // Option Rooms
    OPTION_ROOM_TILEMAP_KEYS.forEach((key) => {
      this.load.tilemapTiledJSON(key, OPTION_ROOM_TILEMAP_PATHS[key]);
    });

    // Trophy Room
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

    // Player
    Player.preload(this);

    this.load.on('progress', (value: number) => {
      emitUI(this, {
        type: 'GAME_LOADING',
        loading: true,
        progress: value,
      });
    });

    this.load.once('complete', () => {
      emitUI(this, {
        type: 'GAME_LOADING',
        loading: false,
        progress: 1,
      });
    });
  }

  create(): void {
    Player.createAnimations(this);

    this.anims.create({
      key: 'elevator-opening',
      frames: this.anims.generateFrameNumbers('elevator', {
        start: 0,
        end: 2,
      }),
      frameRate: 6,
      repeat: 0,
    });

    this.store = new SessionStore();

    this.ws = new WebSocketClient();

    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));

    emitUI(this, {
      type: 'GAME_READY',
    });

    emitUI(this, {
      type: 'START_SCREEN_READY',
    });

    this.ws.connect();
  }

  public submitProblem(problem: string): void {
    const trimmed = problem.trim();
  
    if (!trimmed) {
      return;
    }
  
    this.store.setProblem(trimmed);
  
    emitUI(this, {
      type: 'PROBLEM_SUBMITTING',
      message: 'Generating your first decision...',
    });
  
    this.ws.send({
      type: 'PROBLEM_SUBMITTED',
      problem: trimmed,
    });
  }

  private handleMessage(msg: ServerMessage): void {
    // -------------------------------------------------------
    // New session
    // -------------------------------------------------------

    if (msg.type === 'SESSION_STARTED') {
      this.ws.setSessionId(msg.sessionId);

      this.store.setSession(msg.sessionId);

      this.restoring = false;

      emitUI(this, {
        type: 'SESSION_STARTED',
        sessionId: msg.sessionId,
      });

      return;
    }

    // -------------------------------------------------------
    // Existing session
    // -------------------------------------------------------

    if (msg.type === 'SESSION_RESUMED') {
      this.restoreSession(msg);

      return;
    }

    /*
     * IMPORTANT
     *
     * BootScene must NOT start GrillingScene for every
     * DECISION_CREATED event.
     *
     * Once GrillingScene owns the session, it owns all
     * subsequent DECISION_CREATED messages.
     *
     * This branch only exists for the case where the
     * first decision arrives before the gameplay scene
     * has taken ownership.
     */
    if (msg.type === 'DECISION_CREATED') {
      this.restoreDecision(msg);
    }
  }

  private restoreSession(msg: SessionResumedMsg): void {
    if (this.restoring) {
      return;
    }

    this.restoring = true;

    this.ws.setSessionId(msg.sessionId);

    this.store.hydrate(msg.snapshot);

    emitUI(this, {
      type: 'SESSION_RESUMED',
      sessionId: msg.sessionId,
    });

    const phase = msg.snapshot.phase;

    // No problem yet
    if (phase === 'idle' || phase === 'awaiting_problem') {
      emitUI(this, {
        type: 'START_SCREEN_READY',
      });
    
      return;
    }

    // Waiting for first decision
    if (phase === 'awaiting_question') {
      emitUI(this, {
        type: 'PROBLEM_SUBMITTING',
        message: 'Generating your first decision...',
      });
    
      return;
    }

    // Completed
    if (phase === 'complete') {
      this.leaveBoot();

      this.scene.start('TrophyScene', {
        store: this.store,
      });

      return;
    }

    const currentDecision = this.store.getCurrentDecision();
    if (!currentDecision) {
      emitUI(this, {
        type: 'START_SCREEN_READY',
      });
    
      return;
    }

    const decision: DecisionCreatedMsg = {
      type: 'DECISION_CREATED',
      nodeId: currentDecision.nodeId,
      question: currentDecision.question,
      description: currentDecision.description,
      options: currentDecision.options,
      recommendation: currentDecision.recommendation,
      round: currentDecision.round,
      dependsOn: msg.snapshot.decisions.find((item) => item.id === currentDecision.nodeId)
        ?.dependsOn,
    };

    this.leaveBoot();

    this.scene.start('GrillingScene', {
      ws: this.ws,
      store: this.store,
      decision,
      restored: true,
    });
  }

  private restoreDecision(decision: DecisionCreatedMsg): void {
    this.store.addDecision({
      nodeId: decision.nodeId,
      question: decision.question,
      description: decision.description,
      options: decision.options,
      recommendation: decision.recommendation,
      round: decision.round,
    });

    this.leaveBoot();

    this.scene.start('GrillingScene', {
      ws: this.ws,
      store: this.store,
      decision,
      restored: false,
    });
  }

  shutdown(): void {
    this.unsubscribeWs?.();
    this.unsubscribeWs = undefined;
  }
}
