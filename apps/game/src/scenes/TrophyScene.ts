import Phaser from 'phaser';
import { SessionStore } from '../state/SessionStore';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';
import { PATTERNS_KEY, PATTERNS, TILE_SCALE, DISPLAY_TILE } from '../tiles';

interface SceneData {
  store: SessionStore;
}

/**
 * Trophy Scene — session complete.
 * Shows the summary of decisions and the generated document.
 */
export class TrophyScene extends Phaser.Scene {
  private store!: SessionStore;
  private decisionHistoryContainer?: Phaser.GameObjects.Container;
  private historyScrollOffset = 0;
  private historyContentHeight = 0;

  constructor() {
    super({ key: 'TrophyScene' });
  }

  init(data: SceneData): void {
    this.store = data.store;
  }

  create(): void {
    this.buildRoom();
    this.showTrophy();
  }

  private buildRoom(): void {
    const cols = Math.floor(GAME_WIDTH / DISPLAY_TILE);
    const rows = Math.floor(GAME_HEIGHT / DISPLAY_TILE);

    // Golden sandy floor
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const frame = (x + y) % 2 === 0 ? PATTERNS.TROPHY_FLOOR : PATTERNS.TROPHY_FLOOR_ALT;
        this.add.image(
          x * DISPLAY_TILE + DISPLAY_TILE / 2,
          y * DISPLAY_TILE + DISPLAY_TILE / 2,
          PATTERNS_KEY, frame
        ).setScale(TILE_SCALE).setDepth(0);
      }
    }

    // Dark walls
    for (let x = 0; x < cols; x++) {
      const frame = x % 2 === 0 ? PATTERNS.TROPHY_WALL : PATTERNS.TROPHY_WALL_ALT;
      this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
      this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, (rows - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
    }
    for (let y = 1; y < rows - 1; y++) {
      const frame = y % 2 === 0 ? PATTERNS.TROPHY_WALL : PATTERNS.TROPHY_WALL_ALT;
      this.add.image(DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
      this.add.image((cols - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame).setScale(TILE_SCALE).setDepth(1);
    }

    // Accent tiles along top wall
    for (let i = 3; i < cols - 3; i += 4) {
      this.add.image(i * DISPLAY_TILE, DISPLAY_TILE / 2, PATTERNS_KEY, PATTERNS.DOOR_ALT).setScale(TILE_SCALE).setDepth(3);
    }
  }

  private showTrophy(): void {
    // Trophy title
    this.add.text(GAME_WIDTH / 2, 60, '🏆', { fontSize: '48px' })
      .setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, 120, 'SESSION COMPLETE', {
      fontFamily: FONTS.pixel,
      fontSize: '18px',
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(10);

    // Problem statement
    this.add.text(GAME_WIDTH / 2, 170, `"${this.store.problem}"`, {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.md,
      color: COLORS.textSecondary,
      wordWrap: { width: GAME_WIDTH - 100 },
      align: 'center',
      fontStyle: 'italic',
    }).setOrigin(0.5, 0).setDepth(10);

    // Decision summary panel remains fixed; only the decision history scrolls.
    const panelY = 240;
    const panelWidth = Math.min(600, GAME_WIDTH - 48);
    const panelHeight = 220;
    const panelLeft = GAME_WIDTH / 2 - panelWidth / 2;

    this.add.rectangle(GAME_WIDTH / 2, panelY + 100, panelWidth, panelHeight, COLORS.panelBg, 0.9)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setDepth(9);

    this.add.text(GAME_WIDTH / 2, panelY + 10, 'DECISIONS MADE', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(10);

    const decisions = this.store.decisions.filter((d) => d.selectedOptionId);
    const historyTop = panelY + 40;
    const historyHeight = 150;
    const contentX = panelLeft + 20;
    const contentWidth = panelWidth - 40;

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(contentX, historyTop, contentWidth, historyHeight);
    const historyMask = maskShape.createGeometryMask();

    this.decisionHistoryContainer = this.add.container(0, 0).setDepth(10);
    this.historyContentHeight = decisions.length * 28;
    const maxOffset = Math.max(0, this.historyContentHeight - historyHeight);

    decisions.forEach((d, i) => {
      const y = historyTop + i * 28;
      const selectedLabel = d.options.find((o) => o.id === d.selectedOptionId)?.label ?? '?';

      const roundText = this.add.text(contentX, y, `Round ${d.round}:`, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
      }).setOrigin(0, 0.5);

      const optionText = this.add.text(contentX + 150, y, `${d.selectedOptionId}. ${selectedLabel}`, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textPrimary,
        wordWrap: { width: Math.max(100, contentWidth - 150) },
      }).setOrigin(0, 0.5);

      this.decisionHistoryContainer!.add([roundText, optionText]);
    });

    this.decisionHistoryContainer.setMask(historyMask);

    if (maxOffset > 0) {
      const scrollbarX = panelLeft + panelWidth - 10;
      this.add.rectangle(scrollbarX, historyTop + historyHeight / 2, 4, historyHeight, 0x34344f, 0.9)
        .setDepth(11);

      const thumbHeight = Math.max(24, historyHeight * historyHeight / this.historyContentHeight);
      const thumb = this.add.rectangle(
        scrollbarX,
        historyTop + thumbHeight / 2,
        6,
        thumbHeight,
        COLORS.panelBorder,
        0.95,
      ).setOrigin(0.5).setDepth(12);

      this.input.on('wheel', (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        this.scrollDecisionHistory(dy, maxOffset, historyTop, historyHeight, thumb);
      });
    }

    // Summary stays outside the scroll region.
    if (this.store.summary) {
      this.add.text(GAME_WIDTH / 2, panelY + 230, this.store.summary, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textWarning,
        wordWrap: { width: Math.min(560, GAME_WIDTH - 48) },
        align: 'center',
        lineSpacing: 6,
      }).setOrigin(0.5, 0).setDepth(10);
    }

    // Footer
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 80, '📄 Decision document saved to project', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'Press SPACE to return to Common Room', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.sm,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(10);

    // Space to restart
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.scene.start('CommonRoomScene');
    });
  }
}
