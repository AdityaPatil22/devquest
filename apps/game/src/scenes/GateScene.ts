import Phaser from 'phaser';

import { GameTextInput } from '../ui/GameTextInput';
import { TextButton } from '../ui/TextButton';

import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  FONTS,
} from '../config';

import {
  GATE_TILEMAP_KEY,
  GATE_TILESET,
  GATE_TILE_LAYERS,
  patchGateSceneTileset,
} from '../tilemaps/gateSceneTilemap';

import type {
  ServerMessage,
  DecisionCreatedMsg,
} from '../net/protocol';

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;
  restored?: boolean;
  waitingForQuestion?: boolean;
}

const TITLE_Y = 90;
const SUBTITLE_Y = 138;
const SUBTITLE2_Y = 166;
const INPUT_Y = 210;
const INPUT_HEIGHT = 120;
const BUTTON_Y =
  INPUT_Y +
  INPUT_HEIGHT +
  40;

export class GateScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;

  private textInput!: GameTextInput;

  private ws!: WebSocketClient;

  private store!: SessionStore;

  private submitBtn?: TextButton;

  private waitingText?: Phaser.GameObjects.Text;

  private submitted = false;

  private waitingForQuestion = false;

  constructor() {
    super({
      key: 'GateScene',
    });
  }

  init(data: SceneData): void {
    this.ws = data.ws;
    this.store = data.store;

    this.submitted = false;

    this.waitingForQuestion =
      data.waitingForQuestion ??
      false;

    this.ws.onMessage(
      this.handleMessage.bind(this),
    );
  }

  create(): void {
    this.buildRoom();

    if (this.waitingForQuestion) {
      this.showWaitingForQuestion();
      return;
    }

    this.createInputUI();
  }

  private buildRoom(): void {
    const cached =
      this.cache.tilemap.get(
        GATE_TILEMAP_KEY,
      );

    if (cached?.data) {
      patchGateSceneTileset(
        cached.data,
      );
    }

    this.map =
      this.make.tilemap({
        key: GATE_TILEMAP_KEY,
      });

    const tileset =
      this.map.addTilesetImage(
        GATE_TILESET.name,
        GATE_TILESET.key,
      );

    const tilesets =
      tileset ? [tileset] : [];

    const mapWidthPx =
      this.map.widthInPixels;

    const mapHeightPx =
      this.map.heightInPixels;

    const scale = Math.min(
      GAME_WIDTH / mapWidthPx,
      GAME_HEIGHT / mapHeightPx,
      1,
    );

    const offsetX =
      (GAME_WIDTH -
        mapWidthPx * scale) /
      2;

    const offsetY =
      (GAME_HEIGHT -
        mapHeightPx * scale) /
      2;

    GATE_TILE_LAYERS.forEach(
      (
        layerName,
        depth,
      ) => {
        const layer =
          this.map.createLayer(
            layerName,
            tilesets,
            offsetX,
            offsetY,
          );

        layer
          ?.setScale(scale)
          .setDepth(depth);
      },
    );

    this.add
      .text(
        GAME_WIDTH / 2,
        TITLE_Y,
        '🚪 THE GATE',
        {
          fontFamily:
            FONTS.pixel,
          fontSize: '18px',
          color:
            COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(
        GAME_WIDTH / 2,
        SUBTITLE_Y,
        'What do you want to be grilled on?',
        {
          fontFamily:
            FONTS.pixel,
          fontSize:
            FONTS.size.lg,
          color:
            COLORS.textPrimary,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(
        GAME_WIDTH / 2,
        SUBTITLE2_Y,
        'Enter your problem statement below',
        {
          fontFamily:
            FONTS.pixel,
          fontSize:
            FONTS.size.sm,
          color:
            COLORS.textSecondary,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);
  }

  private createInputUI(): void {
    this.textInput =
      new GameTextInput(
        this.game.canvas
          .parentElement as HTMLElement,
      );

    const canvasRect =
      this.game.canvas.getBoundingClientRect();

    const scaleX =
      canvasRect.width /
      this.cameras.main.width;

    const scaleY =
      canvasRect.height /
      this.cameras.main.height;

    const inputW = 600;

    const inputX =
      canvasRect.left +
      (GAME_WIDTH / 2 -
        inputW / 2) *
        scaleX;

    const inputY =
      canvasRect.top +
      INPUT_Y * scaleY;

    this.textInput.show(
      inputX,
      inputY,
      inputW * scaleX,
      INPUT_HEIGHT * scaleY,
      'e.g. "Should I rewrite the auth service in Go?" or "Design a caching strategy for our API"',
    );

    this.submitBtn =
      new TextButton(
        this,
        {
          x:
            GAME_WIDTH / 2,
          y: BUTTON_Y,
          text:
            'ENTER THE GATE',
          width: 240,
          height: 40,
          onClick:
            () =>
              this.handleSubmit(),
        },
      );

    this.submitBtn.container
      .setScrollFactor(0);
  }

  private showWaitingForQuestion(): void {
    this.waitingText =
      this.add.text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        'Waiting for the next decision...',
        {
          fontFamily:
            FONTS.pixel,
          fontSize:
            FONTS.size.lg,
          color:
            COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setDepth(100);

    this.tweens.add({
      targets:
        this.waitingText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private handleSubmit(): void {
    const problem =
      this.textInput
        .getValue()
        .trim();

    if (
      problem.length === 0 ||
      this.submitted
    ) {
      return;
    }

    this.submitted = true;

    this.store.setProblem(
      problem,
    );

    this.textInput.hide();

    this.submitBtn?.destroy();

    this.waitingText =
      this.add.text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        'Entering the gate...',
        {
          fontFamily:
            FONTS.pixel,
          fontSize:
            FONTS.size.lg,
          color:
            COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setDepth(100);

    this.tweens.add({
      targets:
        this.waitingText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.ws.send({
      type:
        'PROBLEM_SUBMITTED',
      problem,
    });
  }

  private handleMessage(
    msg: ServerMessage,
  ): void {
    if (
      msg.type ===
      'SESSION_STARTED'
    ) {
      this.ws.setSessionId(
        msg.sessionId,
      );

      this.store.setSession(
        msg.sessionId,
      );

      return;
    }

    if (
      msg.type ===
      'SESSION_RESUMED'
    ) {
      this.ws.setSessionId(
        msg.sessionId,
      );

      this.store.hydrate(
        msg.snapshot,
      );

      return;
    }

    if (
      msg.type ===
      'DECISION_CREATED'
    ) {
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

      this.textInput?.hide();

      this.scene.start(
        'DecisionRoomScene',
        {
          ws: this.ws,
          store: this.store,
          decision,
        },
      );

      return;
    }

    if (
      msg.type ===
      'ERROR'
    ) {
      if (this.waitingText) {
        this.waitingText.setText(
          `Error: ${msg.message}`,
        );

        this.tweens.killTweensOf(
          this.waitingText,
        );

        this.waitingText.setAlpha(
          1,
        );
      }

      this.submitted = false;
    }
  }

  shutdown(): void {
    this.textInput?.hide();

    /*
     * Do NOT disconnect the WebSocket.
     *
     * It belongs to the session and is passed
     * to the next scene.
     */
  }
}