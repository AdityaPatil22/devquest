import Phaser from 'phaser';
import { GameTextInput } from '../ui/GameTextInput';
import { TextButton } from '../ui/TextButton';
import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';
import { PATTERNS_KEY, PATTERNS, TILE_SCALE, DISPLAY_TILE } from '../tiles';
import type { ServerMessage, DecisionCreatedMsg } from '../net/protocol';

const COLS = Math.floor(GAME_WIDTH / DISPLAY_TILE);
const ROWS = Math.floor(GAME_HEIGHT / DISPLAY_TILE);

/**
 * Gate Scene — dark, mysterious room.
 * Player types their problem statement and enters the grilling session.
 */
export class GateScene extends Phaser.Scene {
  private textInput!: GameTextInput;
  private ws!: WebSocketClient;
  private store!: SessionStore;
  private submitBtn?: TextButton;
  private waitingText?: Phaser.GameObjects.Text;
  private submitted = false;

  constructor() {
    super({ key: 'GateScene' });
  }

  init(): void {
    this.submitted = false;
  }

  create(): void {
    this.store = new SessionStore();
    this.ws = new WebSocketClient();
    this.ws.onMessage(this.handleMessage.bind(this));
    this.ws.connect();

    this.buildRoom();
    this.createInputUI();
  }

  private buildRoom(): void {
    // Dark stone floor
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const frame = (x + y) % 2 === 0 ? PATTERNS.GATE_FLOOR : PATTERNS.GATE_FLOOR_ALT;
        this.add.image(
          x * DISPLAY_TILE + DISPLAY_TILE / 2,
          y * DISPLAY_TILE + DISPLAY_TILE / 2,
          PATTERNS_KEY, frame
        ).setScale(TILE_SCALE).setDepth(0);
      }
    }

    // Dark walls
    for (let x = 0; x < COLS; x++) {
      const frame = x % 2 === 0 ? PATTERNS.GATE_WALL : PATTERNS.GATE_WALL_ALT;
      this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
      this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, (ROWS - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
    }
    for (let y = 1; y < ROWS - 1; y++) {
      const frame = y % 2 === 0 ? PATTERNS.GATE_WALL : PATTERNS.GATE_WALL_ALT;
      this.add.image(DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
      this.add.image((COLS - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
    }

    // Decorative accent tiles on the top wall
    this.add.image(3 * DISPLAY_TILE, DISPLAY_TILE / 2, PATTERNS_KEY, PATTERNS.DOOR_ALT).setScale(TILE_SCALE).setDepth(3);
    this.add.image((COLS - 3) * DISPLAY_TILE, DISPLAY_TILE / 2, PATTERNS_KEY, PATTERNS.DOOR_ALT).setScale(TILE_SCALE).setDepth(3);

    // Title
    this.add.text(GAME_WIDTH / 2, DISPLAY_TILE * 2 + 8, '🚪 THE GATE', {
      fontFamily: FONTS.pixel, fontSize: '18px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, DISPLAY_TILE * 3 + 8, 'What do you want to be grilled on?', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.lg, color: COLORS.textPrimary,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, DISPLAY_TILE * 3 + 36, 'Enter your problem statement below', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.sm, color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(10);
  }

  private createInputUI(): void {
    this.textInput = new GameTextInput(this.game.canvas.parentElement as HTMLElement);

    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.cameras.main.width;
    const scaleY = canvasRect.height / this.cameras.main.height;

    const inputW = 600;
    const inputH = 120;
    const inputX = canvasRect.left + (GAME_WIDTH / 2 - inputW / 2) * scaleX;
    const inputY = canvasRect.top + (DISPLAY_TILE * 5) * scaleY;

    this.textInput.show(inputX, inputY, inputW * scaleX, inputH * scaleY,
      'e.g. "Should I rewrite the auth service in Go?" or "Design a caching strategy for our API"'
    );

    this.submitBtn = new TextButton(this, {
      x: GAME_WIDTH / 2,
      y: DISPLAY_TILE * 5 + inputH + 40,
      text: 'ENTER THE GATE',
      width: 240,
      height: 40,
      onClick: () => this.handleSubmit(),
    });
  }

  private handleSubmit(): void {
    const problem = this.textInput.getValue().trim();
    if (problem.length === 0 || this.submitted) return;

    this.submitted = true;
    this.store.setProblem(problem);
    this.textInput.hide();
    this.submitBtn?.destroy();

    this.waitingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Entering the gate...', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.lg, color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: this.waitingText, alpha: 0.3,
      duration: 600, yoyo: true, repeat: -1,
    });

    this.ws.send({ type: 'PROBLEM_SUBMITTED', problem });
  }

  private handleMessage(msg: ServerMessage): void {
    if (msg.type === 'SESSION_STARTED') {
      this.store.setSession(msg.sessionId);
    }

    if (msg.type === 'DECISION_CREATED') {
      const decision = msg as DecisionCreatedMsg;
      this.store.addDecision({
        nodeId: decision.nodeId,
        question: decision.question,
        options: decision.options,
        recommendation: decision.recommendation,
        round: decision.round,
      });
      this.textInput.hide();
      this.scene.start('DecisionRoomScene', { ws: this.ws, store: this.store, decision });
    }

    if (msg.type === 'ERROR') {
      if (this.waitingText) {
        this.waitingText.setText('Error: ' + msg.message);
        this.tweens.killTweensOf(this.waitingText);
        this.waitingText.setAlpha(1);
      }
      this.submitted = false;
    }
  }

  shutdown(): void {
    this.textInput?.hide();
  }
}
