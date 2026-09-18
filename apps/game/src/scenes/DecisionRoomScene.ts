import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GameTextInput } from '../ui/GameTextInput';
import { TextButton } from '../ui/TextButton';
import { Panel } from '../ui/Panel';
import { GamePhase } from '../state/GameState';
import { SessionStore, DecisionRecord } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';
import { PATTERNS_KEY, PATTERNS, TILE_SCALE, DISPLAY_TILE } from '../tiles';
import type {
  ServerMessage,
  DecisionCreatedMsg,
  ChallengeMsg,
  EvaluationMsg,
  SessionCompleteMsg,
  DecisionOption,
  Recommendation,
} from '../net/protocol';

interface DoorObject {
  option: DecisionOption;
  x: number;
  y: number;
  doorSprite: Phaser.GameObjects.Image;
  labelText: Phaser.GameObjects.Text;
  isRecommended: boolean;
}

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;
  decision: DecisionCreatedMsg;
}

/**
 * Decision Room — the main game loop scene.
 * Renders N doors from the skill's options. Player walks to a door to select.
 * Reused for every question — just resets with new doors.
 */
export class DecisionRoomScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private ws!: WebSocketClient;
  private store!: SessionStore;
  private textInput!: GameTextInput;

  private doors: DoorObject[] = [];
  private phase = GamePhase.EXPLORING_DOORS;
  private currentDoor?: DoorObject;
  private currentNodeId = '';

  // UI elements
  private questionText?: Phaser.GameObjects.Text;
  private roundText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private panelContainer?: Phaser.GameObjects.Container;
  private waitingText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'DecisionRoomScene' });
  }

  init(data: SceneData): void {
    this.ws = data.ws;
    this.store = data.store;
    this.phase = GamePhase.EXPLORING_DOORS;
    this.currentDoor = undefined;
    this.doors = [];

    this.ws.onMessage(this.handleMessage.bind(this));

    this.currentNodeId = data.decision.nodeId;
    // We'll render the decision in create()
    this.data.set('decision', data.decision);
  }

  create(): void {
    this.textInput = new GameTextInput(
      this.game.canvas.parentElement as HTMLElement
    );

    this.buildRoom();
    this.createPlayer();
    this.setupInput();

    const decision = this.data.get('decision') as DecisionCreatedMsg;
    this.renderDecision(decision);
  }

  update(): void {
    if (this.phase === GamePhase.EXPLORING_DOORS) {
      this.player.handleMovement(this.cursors);
      this.checkDoorProximity();
    } else {
      this.player.stop();
    }
  }

  // ─── Room building ───

  private buildRoom(): void {
    const cols = Math.floor(GAME_WIDTH / DISPLAY_TILE);
    const rows = Math.floor(GAME_HEIGHT / DISPLAY_TILE);

    // Brown stone floor
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const frame = (x + y) % 2 === 0 ? PATTERNS.DECISION_FLOOR : PATTERNS.DECISION_FLOOR_ALT;
        this.add.image(
          x * DISPLAY_TILE + DISPLAY_TILE / 2,
          y * DISPLAY_TILE + DISPLAY_TILE / 2,
          PATTERNS_KEY, frame
        ).setScale(TILE_SCALE).setDepth(0);
      }
    }

    // Walls — all sides
    for (let x = 0; x < cols; x++) {
      const frame = x % 2 === 0 ? PATTERNS.DECISION_WALL : PATTERNS.DECISION_WALL_ALT;
      this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
      this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, (rows - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
    }
    for (let y = 1; y < rows - 1; y++) {
      const frame = y % 2 === 0 ? PATTERNS.DECISION_WALL : PATTERNS.DECISION_WALL_ALT;
      this.add.image(DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
      this.add.image((cols - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
    }
  }

  // ─── Decision rendering ───

  /** Create doors from the skill's options */
  private renderDecision(decision: DecisionCreatedMsg): void {
    this.clearDecision();
    this.currentNodeId = decision.nodeId;

    // Question text at top
    this.roundText = this.add.text(GAME_WIDTH / 2, 30, `ROUND ${decision.round}`, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(10);

    this.questionText = this.add.text(GAME_WIDTH / 2, 60, decision.question, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textPrimary,
      wordWrap: { width: GAME_WIDTH - 100 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(10);

    // Recommendation hint
    if (decision.recommendation) {
      this.add.text(GAME_WIDTH / 2, 110, `💡 Recommended: ${decision.recommendation.option}`, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textWarning,
      }).setOrigin(0.5).setDepth(10);
    }

    // Create doors along the top wall (one tile inside)
    const opts = decision.options;
    const totalWidth = GAME_WIDTH - 200;
    const spacing = totalWidth / (opts.length + 1);
    const doorY = 2 * DISPLAY_TILE + DISPLAY_TILE / 2;

    opts.forEach((option, i) => {
      const doorX = 100 + spacing * (i + 1);
      const isRec = decision.recommendation?.option === option.id;

      const doorSprite = this.add.image(doorX, doorY, PATTERNS_KEY, PATTERNS.DOOR)
        .setDepth(2)
        .setScale(TILE_SCALE);

      // Door letter (A, B, C, D)
      const letterText = this.add.text(doorX, doorY + 30, option.id, {
        fontFamily: FONTS.pixel,
        fontSize: '16px',
        color: isRec ? COLORS.textWarning : COLORS.textHighlight,
      }).setOrigin(0.5).setDepth(10);

      // Door label
      const labelText = this.add.text(doorX, doorY + 50, option.label, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: isRec ? COLORS.textWarning : COLORS.textPrimary,
        wordWrap: { width: spacing - 20 },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(10);

      // Star for recommended
      if (isRec) {
        this.add.text(doorX + 20, doorY + 70, '⭐', {
          fontSize: '12px',
        }).setOrigin(0.5).setDepth(10);
      }

      this.doors.push({
        option,
        x: doorX,
        y: doorY,
        doorSprite,
        labelText,
        isRecommended: isRec,
      });
    });

    this.phase = GamePhase.EXPLORING_DOORS;
  }

  private clearDecision(): void {
    this.doors.forEach((d) => {
      d.doorSprite.destroy();
      d.labelText.destroy();
    });
    this.doors = [];
    this.questionText?.destroy();
    this.roundText?.destroy();
    this.promptText?.destroy();
    this.panelContainer?.destroy();
    this.waitingText?.destroy();
    this.textInput?.hide();
  }

  // ─── Player & interaction ───

  private createPlayer(): void {
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  private checkDoorProximity(): void {
    let nearest: DoorObject | null = null;
    let minDist = Infinity;

    for (const door of this.doors) {
      const dist = Phaser.Math.Distance.Between(
        this.player.sprite.x, this.player.sprite.y, door.x, door.y
      );
      if (dist < 50 && dist < minDist) {
        minDist = dist;
        nearest = door;
      }
    }

    if (nearest && nearest !== this.currentDoor) {
      this.currentDoor = nearest;
      this.showDoorPrompt(nearest);
    } else if (!nearest && this.currentDoor) {
      this.currentDoor = undefined;
      this.hideDoorPrompt();
    }

    if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.approachDoor(nearest);
    }
  }

  private showDoorPrompt(door: DoorObject): void {
    if (!this.promptText) {
      this.promptText = this.add.text(0, 0, '', {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textWarning,
        backgroundColor: '#1a1a2e',
        padding: { x: 4, y: 4 },
      }).setDepth(100);
    }
    this.promptText.setText(`Press E: Door ${door.option.id} — ${door.option.label}`);
    this.promptText.setPosition(door.x - this.promptText.width / 2, door.y + 90);
    this.promptText.setVisible(true);

    // Highlight the door
    door.doorSprite.setTint(0xffaa44);
  }

  private hideDoorPrompt(): void {
    this.promptText?.setVisible(false);
    this.doors.forEach((d) => d.doorSprite.clearTint());
  }

  /** Player pressed E near a door — show context input panel */
  private approachDoor(door: DoorObject): void {
    this.phase = GamePhase.DOOR_CONTEXT;
    this.currentDoor = door;
    this.hideDoorPrompt();

    // Show a panel: "You chose [X]. Add context?"
    const panelBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 620, 280, COLORS.panelBg, 0.95)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setDepth(150);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 170, `Door ${door.option.id}: ${door.option.label}`, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(151);

    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, 'Add context before entering? (optional)', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(151);

    this.panelContainer = this.add.container(0, 0, [panelBg, title, subtitle]);
    this.panelContainer.setDepth(150);

    // Show textarea
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.cameras.main.width;
    const scaleY = canvasRect.height / this.cameras.main.height;
    const inputW = 560;
    const inputH = 80;
    const inputX = canvasRect.left + (GAME_WIDTH / 2 - inputW / 2) * scaleX;
    const inputY = canvasRect.top + (GAME_HEIGHT / 2 - 100) * scaleY;

    this.textInput.show(inputX, inputY, inputW * scaleX, inputH * scaleY,
      '"I was also thinking..." (or leave empty)'
    );

    // Buttons
    const enterBtn = new TextButton(this, {
      x: GAME_WIDTH / 2 - 80,
      y: GAME_HEIGHT / 2 + 50,
      text: 'ENTER DOOR',
      width: 160,
      height: 36,
      onClick: () => {
        const context = this.textInput.getValue().trim();
        this.textInput.hide();
        this.panelContainer?.destroy();
        enterBtn.destroy();
        skipBtn.destroy();
        this.selectDoor(door, context || undefined);
      },
    });

    const skipBtn = new TextButton(this, {
      x: GAME_WIDTH / 2 + 80,
      y: GAME_HEIGHT / 2 + 50,
      text: 'SKIP CONTEXT',
      width: 160,
      height: 36,
      onClick: () => {
        this.textInput.hide();
        this.panelContainer?.destroy();
        enterBtn.destroy();
        skipBtn.destroy();
        this.selectDoor(door, undefined);
      },
    });
  }

  /** Send the selection to the server */
  private selectDoor(door: DoorObject, context?: string): void {
    this.phase = GamePhase.WAITING_FOR_CHALLENGE;
    this.showWaiting('Entering door...');

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

  // ─── Challenge & Evaluation UI ───

  private showChallengePanel(question: string): void {
    this.hideWaiting();
    this.phase = GamePhase.RESPONDING_TO_CHALLENGE;

    const panelBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 620, 320, COLORS.panelBg, 0.95)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setDepth(150);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 170, '🤖 CHALLENGE', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textWarning,
    }).setOrigin(0.5).setDepth(151);

    const qText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 130, question, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.md,
      color: COLORS.textPrimary,
      wordWrap: { width: 560 },
      lineSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(151);

    this.panelContainer = this.add.container(0, 0, [panelBg, title, qText]);
    this.panelContainer.setDepth(150);

    // Text input
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.cameras.main.width;
    const scaleY = canvasRect.height / this.cameras.main.height;
    const inputW = 560;
    const inputH = 80;
    const inputX = canvasRect.left + (GAME_WIDTH / 2 - inputW / 2) * scaleX;
    const inputY = canvasRect.top + (GAME_HEIGHT / 2 - 20) * scaleY;

    this.textInput.show(inputX, inputY, inputW * scaleX, inputH * scaleY,
      'Defend your choice...'
    );

    const submitBtn = new TextButton(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 100,
      text: 'DEFEND',
      width: 160,
      height: 36,
      onClick: () => {
        const response = this.textInput.getValue().trim();
        if (response.length === 0) return;

        this.textInput.hide();
        this.panelContainer?.destroy();
        submitBtn.destroy();
        this.phase = GamePhase.WAITING_FOR_EVALUATION;
        this.showWaiting('AI is evaluating...');

        this.store.updateCurrent({ defense: response });

        this.ws.send({
          type: 'CHALLENGE_RESPONSE',
          nodeId: this.currentNodeId,
          response,
        });
      },
    });
  }

  private showEvaluationPanel(feedback: string, consequence: string): void {
    this.hideWaiting();
    this.phase = GamePhase.SHOWING_EVALUATION;

    const panelBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 620, 300, COLORS.panelBg, 0.95)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setDepth(150);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, '📋 EVALUATION', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(151);

    const fbLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 105, 'Feedback:', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.sm, color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(151);

    const fbText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, feedback, {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.md, color: COLORS.textPrimary,
      wordWrap: { width: 560 }, lineSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(151);

    const csqLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'Consequence:', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.sm, color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(151);

    const csqText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5, consequence, {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.md, color: COLORS.textWarning,
      wordWrap: { width: 560 }, lineSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(151);

    this.panelContainer = this.add.container(0, 0, [panelBg, title, fbLabel, fbText, csqLabel, csqText]);
    this.panelContainer.setDepth(150);

    // "Waiting for next room..." text — the next decision will auto-arrive
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, 'Next room loading...', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.sm, color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(151);
  }

  // ─── Waiting state ───

  private showWaiting(message: string): void {
    this.hideWaiting();
    this.waitingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: this.waitingText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private hideWaiting(): void {
    if (this.waitingText) {
      this.tweens.killTweensOf(this.waitingText);
      this.waitingText.destroy();
      this.waitingText = undefined;
    }
  }

  // ─── Server messages ───

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'CHALLENGE': {
        const challenge = msg as ChallengeMsg;
        this.store.updateCurrent({ challenge: challenge.question });
        this.showChallengePanel(challenge.question);
        break;
      }

      case 'EVALUATION': {
        const evaluation = msg as EvaluationMsg;
        this.store.updateCurrent({
          feedback: evaluation.feedback,
          consequence: evaluation.consequence,
        });
        this.showEvaluationPanel(evaluation.feedback, evaluation.consequence);
        break;
      }

      case 'DECISION_CREATED': {
        // Next question arrived — transition to new room
        const decision = msg as DecisionCreatedMsg;
        this.store.addDecision({
          nodeId: decision.nodeId,
          question: decision.question,
          options: decision.options,
          recommendation: decision.recommendation,
          round: decision.round,
        });

        // Brief pause then render new room
        this.time.delayedCall(2000, () => {
          this.renderDecision(decision);
        });
        break;
      }

      case 'SESSION_COMPLETE': {
        const complete = msg as SessionCompleteMsg;
        this.store.complete(complete.summary, complete.docContent);
        this.textInput.hide();

        this.time.delayedCall(1500, () => {
          this.scene.start('TrophyScene', {
            store: this.store,
          });
        });
        break;
      }

      case 'SESSION_RESUMED':
        // Reconnected to the same session — nothing to reset here,
        // any queued messages will follow immediately.
        break;

      case 'ERROR':
        console.error('Server error:', msg.message);
        break;
    }
  }

  shutdown(): void {
    this.textInput?.hide();
  }
}
