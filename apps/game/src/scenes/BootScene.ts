import Phaser from 'phaser';

import {
  PATTERNS_KEY,
  PATTERNS_PATH,
  PATTERNS_CONFIG,
} from '../tiles';

import {
  TILEMAP_KEY,
  TILEMAP_PATH,
  MAP_TILESETS,
} from '../tilemaps/commonRoomTilemap';

import {
  DECISION_TILEMAP_KEY,
  DECISION_TILEMAP_PATH,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
} from '../tilemaps/decisionRoomTilemap';

import { Player } from '../entities/Player';

import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';

import type {
  ServerMessage,
  SessionResumedMsg,
  DecisionCreatedMsg,
} from '../net/protocol';

export class BootScene extends Phaser.Scene {
  private ws!: WebSocketClient;
  private store!: SessionStore;
  private unsubscribeWs?: () => void;

  private restoring = false;

  private leaveBoot(): void {
    this.unsubscribeWs?.();
    this.unsubscribeWs = undefined;
  }

  constructor() {
    super({
      key: 'BootScene',
    });
  }

  preload(): void {
    this.createLoadingBar();

    this.load.spritesheet(
      PATTERNS_KEY,
      PATTERNS_PATH,
      PATTERNS_CONFIG,
    );

    // Common Room
    this.load.tilemapTiledJSON(
      TILEMAP_KEY,
      TILEMAP_PATH,
    );

    MAP_TILESETS.forEach(
      ({
        key,
        path,
        frameWidth,
        frameHeight,
      }) => {
        this.load.spritesheet(
          key,
          path,
          {
            frameWidth,
            frameHeight,
            margin: 0,
            spacing: 0,
          },
        );
      },
    );

    // Decision Room
    this.load.tilemapTiledJSON(
      DECISION_TILEMAP_KEY,
      DECISION_TILEMAP_PATH,
    );

    const seenKeys = new Set<string>();

    DECISION_TILESETS.forEach(
      ({
        key,
        path,
      }) => {
        if (seenKeys.has(key)) {
          return;
        }

        seenKeys.add(key);

        this.load.spritesheet(
          key,
          path,
          {
            frameWidth:
              DECISION_MAP_TILE_SIZE,
            frameHeight:
              DECISION_MAP_TILE_SIZE,
            margin: 0,
            spacing: 0,
          },
        );
      },
    );

    // Player
    Player.preload(this);
  }

  create(): void {
    Player.createAnimations(this);

    this.store =
      new SessionStore();

    this.ws =
      new WebSocketClient();

    this.unsubscribeWs =
      this.ws.onMessage(
        this.handleMessage.bind(this),
    );

    /*
     * IMPORTANT:
     *
     * BootScene now owns the initial WebSocket.
     *
     * If sessionStorage contains a session ID,
     * WebSocketClient reconnects to that session.
     *
     * If there is no session ID, the server creates
     * a brand-new session.
     */
    this.ws.connect();
  }

  private handleMessage(
    msg: ServerMessage,
  ): void {
    if (
      msg.type ===
      'SESSION_STARTED'
    ) {
      /*
       * Brand-new session.
       *
       * Always begin in Common Room.
       */
      this.ws.setSessionId(
        msg.sessionId,
      );

      this.store.setSession(
        msg.sessionId,
      );

      this.restoring = false;

      this.leaveBoot();

      this.scene.start(
        'CommonRoomScene',
        {
          ws: this.ws,
          store: this.store,
        },
      );

      return;
    }

    if (
      msg.type ===
      'SESSION_RESUMED'
    ) {
      this.restoreSession(msg);

      return;
    }

    /*
     * Normally DECISION_CREATED is handled by the
     * active scene.
     *
     * This fallback handles a decision that arrives
     * immediately after Boot reconnects.
     */
    if (
      msg.type ===
      'DECISION_CREATED'
    ) {
      this.restoreDecision(
        msg,
      );
    }
  }

  private restoreSession(
  msg: SessionResumedMsg,
): void {
  if (this.restoring) {
    return;
  }

  this.restoring = true;

  this.ws.setSessionId(
    msg.sessionId,
  );

  this.store.hydrate(
    msg.snapshot,
  );

  const phase =
    msg.snapshot.phase;

  // No problem submitted yet.
  if (
    phase === 'idle' ||
    phase === 'awaiting_problem'
  ) {
    this.leaveBoot();

    this.scene.start(
      'CommonRoomScene',
      {
        ws: this.ws,
        store: this.store,
      },
    );

    return;
  }

  // Problem submitted, waiting for AI-generated question.
  if (
    phase === 'awaiting_question'
  ) {
    this.leaveBoot();

    this.scene.start(
      'CommonRoomScene',
      {
        ws: this.ws,
        store: this.store,
        gateWaiting: true,
      },
    );

    return;
  }

  // Session finished.
  if (
    phase === 'complete'
  ) {
    this.leaveBoot();

    this.scene.start(
      'TrophyScene',
      {
        store: this.store,
      },
    );

    return;
  }

  // Active decision.
  const currentDecision =
    this.store.getCurrentDecision();

  if (!currentDecision) {
    this.leaveBoot();

    this.scene.start(
      'CommonRoomScene',
      {
        ws: this.ws,
        store: this.store,
      },
    );

    return;
  }

  const decision: DecisionCreatedMsg = {
    type: 'DECISION_CREATED',

    nodeId:
      currentDecision.nodeId,

    question:
      currentDecision.question,

    options:
      currentDecision.options,

    recommendation:
      currentDecision.recommendation,

    round:
      currentDecision.round,

    dependsOn:
      msg.snapshot.decisions.find(
        (d) =>
          d.id ===
          currentDecision.nodeId,
      )?.dependsOn,
  };

  this.leaveBoot();

  this.scene.start(
    'DecisionRoomScene',
    {
      ws: this.ws,
      store: this.store,
      decision,
      restored: true,
    },
  );
  }

  private restoreDecision(
    decision: DecisionCreatedMsg,
  ): void {
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

    this.leaveBoot();

    this.scene.start(
      'DecisionRoomScene',
      {
        ws: this.ws,
        store: this.store,
        decision,
      },
    );
  }

  private createLoadingBar(): void {
    const width =
      this.cameras.main.width;

    const height =
      this.cameras.main.height;

    const barWidth = 320;
    const barHeight = 20;

    this.add
      .rectangle(
        width / 2,
        height / 2,
        barWidth + 4,
        barHeight + 4,
      )
      .setStrokeStyle(
        2,
        0x4a9eff,
      );

    const fill =
      this.add
        .rectangle(
          width / 2 -
            barWidth / 2 +
            2,
          height / 2,
          0,
          barHeight,
          0x4a9eff,
        )
        .setOrigin(
          0,
          0.5,
        );

    this.add
      .text(
        width / 2,
        height / 2 - 24,
        'LOADING...',
        {
          fontFamily:
            '"Press Start 2P"',
          fontSize: '12px',
          color: '#4a9eff',
        },
      )
      .setOrigin(0.5);

    this.load.on(
      'progress',
      (value: number) => {
        fill.width =
          barWidth * value;
      },
    );
  }
}