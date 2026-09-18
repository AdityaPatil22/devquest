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

    // Decision summary panel
    const panelY = 240;
    this.add.rectangle(GAME_WIDTH / 2, panelY + 100, 600, 220, COLORS.panelBg, 0.9)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setDepth(9);

    this.add.text(GAME_WIDTH / 2, panelY + 10, 'DECISIONS MADE', {
      fontFamily: FONTS.pixel,
      fontSize: FONTS.size.lg,
      color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(10);

    // List each decision
    const decisions = this.store.decisions.filter((d) => d.selectedOptionId);
    const startY = panelY + 40;
    decisions.forEach((d, i) => {
      const selectedLabel = d.options.find((o) => o.id === d.selectedOptionId)?.label ?? '?';
      const text = `${d.selectedOptionId}. ${selectedLabel}`;

      this.add.text(220, startY + i * 28, `Round ${d.round}:`, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textSecondary,
      }).setDepth(10);

      this.add.text(380, startY + i * 28, text, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textPrimary,
      }).setDepth(10);
    });

    // Summary
    if (this.store.summary) {
      this.add.text(GAME_WIDTH / 2, panelY + 230, this.store.summary, {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textWarning,
        wordWrap: { width: 560 },
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
