import Phaser from 'phaser';
import { GameTextInput } from '../ui/GameTextInput';
import { TextButton } from '../ui/TextButton';
import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';
import {
  GATE_TILEMAP_KEY,
  GATE_TILESET,
  GATE_TILE_LAYERS,
  patchGateSceneTileset,
} from '../gateSceneTilemap';
import type { ServerMessage, DecisionCreatedMsg } from '../net/protocol';

// Fixed HUD layout constants (viewport-relative, independent of the map's
// own pixel size — the map is centered separately, see buildRoom()).
const TITLE_Y = 90;
const SUBTITLE_Y = 138;
const SUBTITLE2_Y = 166;
const INPUT_Y = 210;
const INPUT_HEIGHT = 120;
const BUTTON_Y = INPUT_Y + INPUT_HEIGHT + 40;

/**
 * Gate Scene — dark, mysterious room.
 * Player types their problem statement and enters the grilling session.
 */
export class GateScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
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

  /**
   * Builds the room directly from the hand-authored Tiled map
   * (public/assets/map/gatescene/gatescene.json) instead of the old
   * procedurally-generated tile grid. There's no player in this scene —
   * it's a static backdrop behind the problem-statement form.
   */
  private buildRoom(): void {
    // The map's tileset is only referenced as an external .tsx file, which
    // Phaser can't load — patch in an embedded tileset definition before
    // parsing (see gateSceneTilemap.ts for why this is safe).
    const cached = this.cache.tilemap.get(GATE_TILEMAP_KEY);
    if (cached?.data) {
      patchGateSceneTileset(cached.data);
    }

    this.map = this.make.tilemap({ key: GATE_TILEMAP_KEY });

    const tileset = this.map.addTilesetImage(GATE_TILESET.name, GATE_TILESET.key);
    const tilesets = tileset ? [tileset] : [];

    // The map (1920×1040px) is often bigger than the viewport, and this
    // scene never scrolls, so scale it down (never up) to fit entirely on
    // screen with all four walls visible, then center it. Everything is
    // done in plain world coordinates with the camera left at its default
    // zoom/scroll, so the HUD's screen-space math below stays simple.
    const mapWidthPx = this.map.widthInPixels;
    const mapHeightPx = this.map.heightInPixels;
    const scale = Math.min(GAME_WIDTH / mapWidthPx, GAME_HEIGHT / mapHeightPx, 1);
    const offsetX = (GAME_WIDTH - mapWidthPx * scale) / 2;
    const offsetY = (GAME_HEIGHT - mapHeightPx * scale) / 2;

    GATE_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = this.map.createLayer(layerName, tilesets, offsetX, offsetY);
      layer?.setScale(scale);
      layer?.setDepth(depth);
    });

    // Title & instructions — fixed to the screen (not the world), so they
    // stay put regardless of where the centered map sits.
    this.add.text(GAME_WIDTH / 2, TITLE_Y, '🚪 THE GATE', {
      fontFamily: FONTS.pixel, fontSize: '18px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    this.add.text(GAME_WIDTH / 2, SUBTITLE_Y, 'What do you want to be grilled on?', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.lg, color: COLORS.textPrimary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    this.add.text(GAME_WIDTH / 2, SUBTITLE2_Y, 'Enter your problem statement below', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.sm, color: COLORS.textSecondary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);
  }

  private createInputUI(): void {
    this.textInput = new GameTextInput(this.game.canvas.parentElement as HTMLElement);

    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.cameras.main.width;
    const scaleY = canvasRect.height / this.cameras.main.height;

    const inputW = 600;
    const inputX = canvasRect.left + (GAME_WIDTH / 2 - inputW / 2) * scaleX;
    const inputY = canvasRect.top + INPUT_Y * scaleY;

    this.textInput.show(inputX, inputY, inputW * scaleX, INPUT_HEIGHT * scaleY,
      'e.g. "Should I rewrite the auth service in Go?" or "Design a caching strategy for our API"'
    );

    this.submitBtn = new TextButton(this, {
      x: GAME_WIDTH / 2,
      y: BUTTON_Y,
      text: 'ENTER THE GATE',
      width: 240,
      height: 40,
      onClick: () => this.handleSubmit(),
    });
    this.submitBtn.container.setScrollFactor(0);
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
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.tweens.add({
      targets: this.waitingText, alpha: 0.3,
      duration: 600, yoyo: true, repeat: -1,
    });

    this.ws.send({ type: 'PROBLEM_SUBMITTED', problem });
  }

  private handleMessage(msg: ServerMessage): void {
    if (msg.type === 'SESSION_STARTED') {
      this.store.setSession(msg.sessionId);
      this.ws.setSessionId(msg.sessionId);
    }

    if (msg.type === 'SESSION_RESUMED') {
      this.store.setSession(msg.sessionId);
      this.ws.setSessionId(msg.sessionId);
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
    // Don't disconnect — the WS is passed to the next scene.
    // Only disconnect if we're not transitioning (e.g., game closing).
  }
}
