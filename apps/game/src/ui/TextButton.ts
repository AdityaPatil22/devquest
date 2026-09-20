import Phaser from 'phaser';
import { COLORS } from '../config';

export interface TextButtonConfig {
  x: number;
  y: number;
  text: string;
  width?: number;
  height?: number;
  onClick: () => void;
}

/**
 * A clickable button with text, hover, and press states.
 */
export class TextButton {
  public container: Phaser.GameObjects.Container;

  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, config: TextButtonConfig) {
    const width = config.width ?? 200;
    const height = config.height ?? 32;

    this.bg = scene.add
      .rectangle(0, 0, width, height, COLORS.buttonBg)
      .setStrokeStyle(1, COLORS.panelBorder)
      .setOrigin(0.5);

    this.label = scene.add
      .text(0, 0, config.text, {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: COLORS.buttonText,
      })
      .setOrigin(0.5);

    this.container = scene.add.container(config.x, config.y, [
      this.bg,
      this.label,
    ]);

    // Keep buttons above modal panels.
    this.container
      .setScrollFactor(0)
      .setDepth(160);

    // Make the entire button area interactive.
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(
        -width / 2,
        -height / 2,
        width,
        height,
      ),
      Phaser.Geom.Rectangle.Contains,
    );

    this.container.on('pointerover', () => {
      this.bg.setFillStyle(COLORS.buttonHover);
    });

    this.container.on('pointerout', () => {
      this.bg.setFillStyle(COLORS.buttonBg);
    });

    this.container.on('pointerdown', () => {
      this.bg.setFillStyle(COLORS.panelBorder);
    });

    this.container.on('pointerup', () => {
      this.bg.setFillStyle(COLORS.buttonHover);
      config.onClick();
    });
  }

  destroy(): void {
    this.container.destroy();
  }
}