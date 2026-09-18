import Phaser from 'phaser';
import { COLORS } from '../config';

export interface PanelConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * Base panel: a bordered rectangle background that other panels extend.
 */
export class Panel {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  protected background: Phaser.GameObjects.Rectangle;
  protected panelWidth: number;
  protected panelHeight: number;

  constructor(scene: Phaser.Scene, config: PanelConfig) {
    this.scene = scene;
    this.panelWidth = config.width ?? 600;
    this.panelHeight = config.height ?? 400;

    this.background = scene.add
      .rectangle(0, 0, this.panelWidth, this.panelHeight, COLORS.panelBg, 0.95)
      .setStrokeStyle(2, COLORS.panelBorder)
      .setOrigin(0.5);

    this.container = scene.add.container(config.x, config.y, [this.background]);
    this.container.setDepth(150);
  }

  destroy(): void {
    this.container.destroy();
  }

  protected addText(
    x: number,
    y: number,
    text: string,
    options: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}
  ): Phaser.GameObjects.Text {
    const textObj = this.scene.add.text(x, y, text, {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: COLORS.textPrimary,
      wordWrap: { width: this.panelWidth - 48 },
      lineSpacing: 6,
      ...options,
    });
    textObj.setOrigin(0.5, 0);
    this.container.add(textObj);
    return textObj;
  }
}
