import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GameTextInput } from '../ui/GameTextInput';
import { TextButton } from '../ui/TextButton';
import { Panel } from '../ui/Panel';
import { GamePhase } from '../state/GameState';
import { SessionStore, DecisionRecord } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';
import { PATTERNS_KEY, PATTERNS } from '../tiles';
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
} from '../decisionRoomTilemap';
import type {
  ServerMessage,
  DecisionCreatedMsg,
  ChallengeMsg,
  EvaluationMsg,
  SessionCompleteMsg,
  DecisionOption,
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

const DOOR_SCALE = 2;

export class DecisionRoomScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private ws!: WebSocketClient;
  private store!: SessionStore;
  private textInput!: GameTextInput;

  private map!: Phaser.Tilemaps.Tilemap;
  private wallsLayer?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;

  private doors: DoorObject[] = [];
  private phase = GamePhase.EXPLORING_DOORS;
  private currentDoor?: DoorObject;
  private currentNodeId = '';

  // All UI created for the current decision/round is tracked here so it can
  // be destroyed together before the next decision is rendered.
  private roundUiContainer?: Phaser.GameObjects.Container;
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
    this.data.set('decision', data.decision);
  }

  create(): void {
    this.textInput = new GameTextInput(
      this.game.canvas.parentElement as HTMLElement
    );

    this.buildRoom();
    this.createPlayer();
    this.setupInput();

    if (this.wallsLayer) {
      this.physics.add.collider(this.player.sprite, this.wallsLayer);
    }

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

  private buildRoom(): void {
    const cached = this.cache.tilemap.get(DECISION_TILEMAP_KEY);
    if (cached?.data) {
      patchDecisionRoomTilesets(cached.data);
    }

    this.map = this.make.tilemap({ key: DECISION_TILEMAP_KEY });

    const tilesets = DECISION_TILESETS.map((t) =>
      this.map.addTilesetImage(t.name, t.key),
    ).filter((t): t is Phaser.Tilemaps.Tileset => t !== null);

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

  private renderDecision(decision: DecisionCreatedMsg): void {
    this.clearDecision();
    this.currentNodeId = decision.nodeId;

    this.roundUiContainer = this.add.container(0, 0).setDepth(100);

    this.roundText = this.add.text(GAME_WIDTH / 2, 30, `ROUND ${decision.round}`, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setScrollFactor(0);

    this.questionText = this.add.text(GAME_WIDTH / 2, 60, decision.question, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textPrimary,
      wordWrap: { width: GAME_WIDTH - 100 },
      align: 'center',
    }).setOrigin(0.5, 0).setScrollFactor(0);

    this.roundUiContainer.add([this.roundText, this.questionText]);

    if (decision.recommendation) {
      const recommendationText = this.add.text(
        GAME_WIDTH / 2,
        110,
        `💡 Recommended: ${decision.recommendation.option}`,
        {
          fontFamily: FONTS.pixel,
          fontSize: FONTS.size.sm,
          color: COLORS.textWarning,
        },
      ).setOrigin(0.5).setScrollFactor(0);

      this.roundUiContainer.add(recommendationText);
    }

    const opts = decision.options;
    const rangeStartPx = DECISION_DOOR_ROW_X_RANGE.minTileX * DECISION_MAP_TILE_SIZE;
    const rangeWidthPx =
      (DECISION_DOOR_ROW_X_RANGE.maxTileX - DECISION_DOOR_ROW_X_RANGE.minTileX + 1) *
      DECISION_MAP_TILE_SIZE;
    const spacing = rangeWidthPx / (opts.length + 1);
    const doorY = DECISION_DOOR_ROW_TILE_Y * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;

    opts.forEach((option, i) => {
      const doorX = rangeStartPx + spacing * (i + 1);
      const isRec = decision.recommendation?.option === option.id;

      const doorSprite = this.add.image(doorX, doorY, PATTERNS_KEY, PATTERNS.DOOR)
        .setDepth(5)
        .setScale(DOOR_SCALE);

      const letterText = this.add.text(doorX, doorY + 30, option.id, {
        fontFamily: FONTS.pixel,
        fontSize: '16px',
        color: isRec ? COLORS.textWarning : COLORS.textHighlight,
      }).setOrigin(0.5).setDepth(10);

      const labelText = this.add.text(doorX, doorY + 50, option.label, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: isRec ? COLORS.textWarning : COLORS.textPrimary,
        wordWrap: { width: spacing - 20 },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(10);

      this.roundUiContainer.add([doorSprite, letterText, labelText]);

      if (isRec) {
        const recommendationStar = this.add.text(doorX + 20, doorY + 70, '⭐', {
          fontSize: '12px',
        }).setOrigin(0.5).setDepth(10);

        this.roundUiContainer.add(recommendationStar);
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
    this.doors.forEach((d) => d.doorSprite.clearTint());
    this.doors = [];
    this.currentDoor = undefined;

    if (this.roundUiContainer) {
      this.roundUiContainer.destroy(true);
      this.roundUiContainer = undefined;
    }

    this.promptText = undefined;
    this.panelContainer = undefined;
    this.waitingText = undefined;
    this.textInput?.hide();
  }

  private createPlayer(): void {
    const spawnX = DECISION_SPAWN_TILE.x * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;
    const spawnY = DECISION_SPAWN_TILE.y * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;
    this.player = new Player(this, spawnX, spawnY);
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

      this.roundUiContainer?.add(this.promptText);
    }

    this.promptText.setText(`Press E: Door ${door.option.id} — ${door.option.label}`);
    this.promptText.setPosition(door.x - this.promptText.width / 2, door.y + 90);
    this.promptText.setVisible(true);
    door.doorSprite.setTint(0xffaa44);
  }

  private hideDoorPrompt(): void {
    this.promptText?.setVisible(false);
    this.doors.forEach((d) => d.doorSprite.clearTint());
  }

  private approachDoor(door: DoorObject): void {
    this.phase = GamePhase.DOOR_CONTEXT;
    this.currentDoor = door;
    this.hideDoorPrompt();

    const panelBg = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 60,
      620,
      280,
      COLORS.panelBg,
      0.95,
    ).setStrokeStyle(2, COLORS.panelBorder).setDepth(150);

    const title = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 170,
      `Door ${door.option.id}: ${door.option.label}`,
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.lg,
        color: COLORS.textHighlight,
      },
    ).setOrigin(0.5).setDepth(151);

    const subtitle = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 140,
      'Add context before entering? (optional)',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
      },
    ).setOrigin(0.5).setDepth(151);

    this.panelContainer = this.add.container(0, 0, [panelBg, title, subtitle]);
    this.panelContainer.setDepth(150).setScrollFactor(0);
    this.roundUiContainer?.add(this.panelContainer);

    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.cameras.main.width;
    const scaleY = canvasRect.height / this.cameras.main.height;
    const inputW = 560;
    const inputH = 80;
    const inputX = canvasRect.left + (GAME_WIDTH / 2 - inputW / 2) * scaleX;
    const inputY = canvasRect.top + (GAME_HEIGHT / 2 - 100) * scaleY;

    this.textInput.show(
      inputX,
      inputY,
      inputW * scaleX,
      inputH * scaleY,
      '"I was also thinking..." (or leave empty)',
    );

    let enterBtn: TextButton;
    let skipBtn: TextButton;

    enterBtn = new TextButton(this, {
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
        this.panelContainer = undefined;
        this.selectDoor(door, context || undefined);
      },
    });
    enterBtn.container.setScrollFactor(0);
    this.roundUiContainer?.add(enterBtn.container);

    skipBtn = new TextButton(this, {
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
        this.panelContainer = undefined;
        this.selectDoor(door, undefined);
      },
    });
    skipBtn.container.setScrollFactor(0);
    this.roundUiContainer?.add(skipBtn.container);
  }

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

  private showChallengePanel(question: string): void {
    this.hideWaiting();
    this.phase = GamePhase.RESPONDING_TO_CHALLENGE;

    const panelBg = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 40,
      620,
      320,
      COLORS.panelBg,
      0.95,
    ).setStrokeStyle(2, COLORS.panelBorder).setDepth(150);

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
    this.panelContainer.setDepth(150).setScrollFactor(0);
    this.roundUiContainer?.add(this.panelContainer);

    const canvasRect = this.game.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.cameras.main.width;
    const scaleY = canvasRect.height / this.cameras.main.height;
    const inputW = 560;
    const inputH = 80;
    const inputX = canvasRect.left + (GAME_WIDTH / 2 - inputW / 2) * scaleX;
    const inputY = canvasRect.top + (GAME_HEIGHT / 2 - 20) * scaleY;

    this.textInput.show(
      inputX,
      inputY,
      inputW * scaleX,
      inputH * scaleY,
      'Defend your choice...',
    );

    let submitBtn: TextButton;
    submitBtn = new TextButton(this, {
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
        this.panelContainer = undefined;
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
    submitBtn.container.setScrollFactor(0);
    this.roundUiContainer?.add(submitBtn.container);
  }

  private showEvaluationPanel(feedback: string, consequence: string): void {
    this.hideWaiting();
    this.phase = GamePhase.SHOWING_EVALUATION;

    const panelBg = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 20,
      620,
      300,
      COLORS.panelBg,
      0.95,
    ).setStrokeStyle(2, COLORS.panelBorder).setDepth(150);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 140, '📋 EVALUATION', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(151);

    const fbLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 105, 'Feedback:', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(151);

    const fbText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, feedback, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.md,
      color: COLORS.textPrimary,
      wordWrap: { width: 560 },
      lineSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(151);

    const csqLabel = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'Consequence:', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(151);

    const csqText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5, consequence, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.md,
      color: COLORS.textWarning,
      wordWrap: { width: 560 },
      lineSpacing: 6,
    }).setOrigin(0.5, 0).setDepth(151);

    this.panelContainer = this.add.container(0, 0, [
      panelBg,
      title,
      fbLabel,
      fbText,
      csqLabel,
      csqText,
    ]);
    this.panelContainer.setDepth(150).setScrollFactor(0);
    this.roundUiContainer?.add(this.panelContainer);

    const nextRoomText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 100,
      'Next room loading...',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
      },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(151);

    this.roundUiContainer?.add(nextRoomText);
  }

  private showWaiting(message: string): void {
    this.hideWaiting();
    this.waitingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.roundUiContainer?.add(this.waitingText);

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
        const decision = msg as DecisionCreatedMsg;
        this.store.addDecision({
          nodeId: decision.nodeId,
          question: decision.question,
          options: decision.options,
          recommendation: decision.recommendation,
          round: decision.round,
        });

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
        break;

      case 'ERROR':
        console.error('Server error:', msg.message);
        break;
    }
  }

  shutdown(): void {
    this.textInput?.hide();
    this.clearDecision();
  }
}
