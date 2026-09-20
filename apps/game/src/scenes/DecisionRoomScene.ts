import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GameTextInput } from '../ui/GameTextInput';
import { TextButton } from '../ui/TextButton';
import { GamePhase } from '../state/GameState';
import { SessionStore } from '../state/SessionStore';
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
const PANEL_MAX_WIDTH = 620;
const PANEL_MIN_WIDTH = 280;
const PANEL_HORIZONTAL_MARGIN = 24;
const PANEL_MAX_INPUT_WIDTH = 560;
const PANEL_INPUT_HEIGHT = 80;
const PANEL_HEIGHTS = {
  context: 280,
  challenge: 320,
  evaluation: 300,
} as const;

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

  private questionText?: Phaser.GameObjects.Text;
  private roundText?: Phaser.GameObjects.Text;
  private recommendationText?: Phaser.GameObjects.Text;
  private promptText?: Phaser.GameObjects.Text;
  private panelContainer?: Phaser.GameObjects.Container;
  private waitingText?: Phaser.GameObjects.Text;
  private activePanelType?: keyof typeof PANEL_HEIGHTS;
  private resizeHandler?: () => void;

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

    this.resizeHandler = () => this.repositionTextInput();
    this.scale.on('resize', this.resizeHandler);

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

  private getViewportSize(): { width: number; height: number } {
    const width = this.scale.gameSize.width || GAME_WIDTH;
    const height = this.scale.gameSize.height || GAME_HEIGHT;
    return { width, height };
  }

  private getResponsivePanelMetrics(
    height: number,
  ): { width: number; inputWidth: number; margin: number } {
    const width = this.getViewportSize().width;
    const margin = Math.max(PANEL_HORIZONTAL_MARGIN, Math.round(width * 0.05));
    const panelWidth = Math.min(
      PANEL_MAX_WIDTH,
      Math.max(PANEL_MIN_WIDTH, width - margin * 2),
    );

    // Leave enough horizontal breathing room for narrow screens.
    const inputWidth = Math.min(
      PANEL_MAX_INPUT_WIDTH,
      Math.max(220, panelWidth - 40),
    );

    return {
      width: panelWidth,
      inputWidth,
      margin,
    };
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

    this.roundText = this.add.text(GAME_WIDTH / 2, 30, `ROUND ${decision.round}`, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.questionText = this.add.text(GAME_WIDTH / 2, 60, decision.question, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textPrimary,
      wordWrap: { width: Math.max(220, GAME_WIDTH - 100) },
      align: 'center',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    if (decision.recommendation) {
      this.recommendationText = this.add.text(
        GAME_WIDTH / 2,
        110,
        `💡 Recommended: ${decision.recommendation.option}`,
        {
          fontFamily: FONTS.pixel,
          fontSize: FONTS.size.sm,
          color: COLORS.textWarning,
        },
      ).setOrigin(0.5).setScrollFactor(0).setDepth(100);
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
        wordWrap: { width: Math.max(120, spacing - 20) },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(10);

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
    this.currentDoor = undefined;

    this.questionText?.destroy();
    this.questionText = undefined;
    this.roundText?.destroy();
    this.roundText = undefined;
    this.recommendationText?.destroy();
    this.recommendationText = undefined;
    this.promptText?.destroy();
    this.promptText = undefined;
    this.panelContainer?.destroy(true);
    this.panelContainer = undefined;
    this.waitingText?.destroy();
    this.waitingText = undefined;
    this.activePanelType = undefined;

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

  private createPanel(): Phaser.GameObjects.Container {
    return this.add.container(0, 0)
      .setDepth(150)
      .setScrollFactor(0);
  }

  private createPanelBackground(
    panel: Phaser.GameObjects.Container,
    height: number,
  ): { width: number; inputWidth: number } {
    const { width, inputWidth } = this.getResponsivePanelMetrics(height);
    const viewport = this.getViewportSize();
    const centerY = viewport.height / 2;

    const bg = this.add.rectangle(
      viewport.width / 2,
      centerY,
      width,
      height,
      COLORS.panelBg,
      0.95,
    ).setStrokeStyle(2, COLORS.panelBorder);

    panel.add(bg);
    return { width, inputWidth };
  }

  private getDomInputPosition(
    inputWidth: number,
    topOffset: number,
  ): { left: number; top: number; width: number; height: number } {
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const { width: viewportWidth, height: viewportHeight } = this.getViewportSize();
    const scaleX = canvasRect.width / viewportWidth;
    const scaleY = canvasRect.height / viewportHeight;

    const x = (viewportWidth - inputWidth) / 2;
    const y = viewportHeight / 2 + topOffset;

    return {
      left: canvasRect.left + x * scaleX,
      top: canvasRect.top + y * scaleY,
      width: inputWidth * scaleX,
      height: PANEL_INPUT_HEIGHT * scaleY,
    };
  }

  private positionTextInput(inputWidth: number, topOffset: number): void {
    const pos = this.getDomInputPosition(inputWidth, topOffset);
    this.textInput.show(
      pos.left,
      pos.top,
      pos.width,
      pos.height,
      this.activePanelType === 'context'
        ? '"I was also thinking..." (or leave empty)'
        : 'Defend your choice...',
    );
  }

  private repositionTextInput(): void {
    if (!this.activePanelType || !this.textInput) return;

    const { inputWidth } = this.getResponsivePanelMetrics(
      PANEL_HEIGHTS[this.activePanelType],
    );

    const topOffset = this.activePanelType === 'context' ? -100 : -20;
    this.positionTextInput(inputWidth, topOffset);
  }

  private getButtonLayout(buttonCount: number): { width: number; height: number; positions: number[] } {
    const { width } = this.getViewportSize();
    const available = Math.max(220, Math.min(width - 40, PANEL_MAX_WIDTH - 40));

    if (buttonCount === 1) {
      return {
        width: Math.min(160, available),
        height: 36,
        positions: [width / 2],
      };
    }

    const gap = 12;
    const buttonWidth = Math.min(160, Math.floor((available - gap) / buttonCount));
    const totalWidth = buttonWidth * buttonCount + gap * (buttonCount - 1);
    const startX = (width - totalWidth) / 2 + buttonWidth / 2;

    return {
      width: buttonWidth,
      height: 36,
      positions: Array.from({ length: buttonCount }, (_, index) =>
        startX + index * (buttonWidth + gap),
      ),
    };
  }

  private approachDoor(door: DoorObject): void {
    this.phase = GamePhase.DOOR_CONTEXT;
    this.currentDoor = door;
    this.hideDoorPrompt();

    this.panelContainer?.destroy(true);

    const viewport = this.getViewportSize();
    const panel = this.createPanel();
    this.panelContainer = panel;
    this.activePanelType = 'context';

    const { inputWidth } = this.createPanelBackground(panel, PANEL_HEIGHTS.context);

    const title = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 170,
      `Door ${door.option.id}: ${door.option.label}`,
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.lg,
        color: COLORS.textHighlight,
        wordWrap: { width: Math.max(220, inputWidth) },
        align: 'center',
      },
    ).setOrigin(0.5);
    panel.add(title);

    const subtitle = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 140,
      'Add context before entering? (optional)',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
        wordWrap: { width: Math.max(220, inputWidth) },
        align: 'center',
      },
    ).setOrigin(0.5);
    panel.add(subtitle);

    this.positionTextInput(inputWidth, -100);

    const { width: buttonWidth, positions } = this.getButtonLayout(2);
    const buttonY = viewport.height / 2 + 50;

    let enterBtn: TextButton;
    let skipBtn: TextButton;

    enterBtn = new TextButton(this, {
      x: positions[0],
      y: buttonY,
      text: 'ENTER DOOR',
      width: buttonWidth,
      height: 36,
      onClick: () => {
        const context = this.textInput.getValue().trim();
        this.textInput.hide();
        this.panelContainer?.destroy(true);
        this.panelContainer = undefined;
        this.activePanelType = undefined;
        enterBtn.destroy();
        skipBtn.destroy();
        this.selectDoor(door, context || undefined);
      },
    });
    enterBtn.container.setScrollFactor(0);
    panel.add(enterBtn.container);

    skipBtn = new TextButton(this, {
      x: positions[1],
      y: buttonY,
      text: 'SKIP CONTEXT',
      width: buttonWidth,
      height: 36,
      onClick: () => {
        this.textInput.hide();
        this.panelContainer?.destroy(true);
        this.panelContainer = undefined;
        this.activePanelType = undefined;
        enterBtn.destroy();
        skipBtn.destroy();
        this.selectDoor(door, undefined);
      },
    });
    skipBtn.container.setScrollFactor(0);
    panel.add(skipBtn.container);
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

    this.panelContainer?.destroy(true);

    const viewport = this.getViewportSize();
    const panel = this.createPanel();
    this.panelContainer = panel;
    this.activePanelType = 'challenge';

    const { inputWidth } = this.createPanelBackground(panel, PANEL_HEIGHTS.challenge);

    const title = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 170,
      '🤖 CHALLENGE',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.lg,
        color: COLORS.textWarning,
        wordWrap: { width: Math.max(220, inputWidth) },
        align: 'center',
      },
    ).setOrigin(0.5);
    panel.add(title);

    const qText = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 130,
      question,
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.md,
        color: COLORS.textPrimary,
        wordWrap: { width: Math.max(220, inputWidth) },
        lineSpacing: 6,
        align: 'center',
      },
    ).setOrigin(0.5, 0);
    panel.add(qText);

    this.positionTextInput(inputWidth, -20);

    const { width: buttonWidth } = this.getButtonLayout(1);
    const submitBtn = new TextButton(this, {
      x: viewport.width / 2,
      y: viewport.height / 2 + 100,
      text: 'DEFEND',
      width: buttonWidth,
      height: 36,
      onClick: () => {
        const response = this.textInput.getValue().trim();
        if (response.length === 0) return;

        this.textInput.hide();
        this.panelContainer?.destroy(true);
        this.panelContainer = undefined;
        this.activePanelType = undefined;
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
    submitBtn.container.setScrollFactor(0);
    panel.add(submitBtn.container);
  }

  private showEvaluationPanel(feedback: string, consequence: string): void {
    this.hideWaiting();
    this.phase = GamePhase.SHOWING_EVALUATION;

    this.panelContainer?.destroy(true);

    const viewport = this.getViewportSize();
    const panel = this.createPanel();
    this.panelContainer = panel;
    this.activePanelType = 'evaluation';

    const { inputWidth } = this.createPanelBackground(panel, PANEL_HEIGHTS.evaluation);

    const title = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 140,
      '📋 EVALUATION',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.lg,
        color: COLORS.textHighlight,
        wordWrap: { width: Math.max(220, inputWidth) },
        align: 'center',
      },
    ).setOrigin(0.5);
    panel.add(title);

    const fbLabel = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 105,
      'Feedback:',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
      },
    ).setOrigin(0.5);
    panel.add(fbLabel);

    const fbText = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 80,
      feedback,
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.md,
        color: COLORS.textPrimary,
        wordWrap: { width: Math.max(220, inputWidth) },
        lineSpacing: 6,
        align: 'center',
      },
    ).setOrigin(0.5, 0);
    panel.add(fbText);

    const csqLabel = this.add.text(
      viewport.width / 2,
      viewport.height / 2 - 20,
      'Consequence:',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
      },
    ).setOrigin(0.5);
    panel.add(csqLabel);

    const csqText = this.add.text(
      viewport.width / 2,
      viewport.height / 2 + 5,
      consequence,
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.md,
        color: COLORS.textWarning,
        wordWrap: { width: Math.max(220, inputWidth) },
        lineSpacing: 6,
        align: 'center',
      },
    ).setOrigin(0.5, 0);
    panel.add(csqText);

    const nextRoomText = this.add.text(
      viewport.width / 2,
      viewport.height / 2 + 100,
      'Next room loading...',
      {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
        wordWrap: { width: Math.max(220, inputWidth) },
        align: 'center',
      },
    ).setOrigin(0.5);
    panel.add(nextRoomText);

    this.activePanelType = 'evaluation';
  }

  private showWaiting(message: string): void {
    this.hideWaiting();
    const viewport = this.getViewportSize();

    this.waitingText = this.add.text(viewport.width / 2, viewport.height / 2, message, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
      wordWrap: { width: Math.max(220, viewport.width - 40) },
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

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
    if (this.resizeHandler) {
      this.scale.off('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }
    this.textInput?.hide();
    this.clearDecision();
  }
}
