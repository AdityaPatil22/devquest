import Phaser from 'phaser';
import { COLORS } from '../config';

export class InteractionZone {
  public zone: Phaser.GameObjects.Zone;
  public x: number;
  public y: number;
  public areaId: string;
  public label: string;

  private border: Phaser.GameObjects.Rectangle;
  private labelText: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Rectangle;
  private isPlayerInside = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    areaId: string,
    label: string,
    color: number
  ) {
    this.x = x;
    this.y = y;
    this.areaId = areaId;
    this.label = label;

    // Visual room border
    this.border = scene.add
      .rectangle(x, y, 128, 96, 0x000000, 0)
      .setStrokeStyle(2, color, 0.7)
      .setDepth(1);

    // Room icon (colored square)
    this.icon = scene.add
      .rectangle(x, y - 8, 24, 24, color, 0.3)
      .setStrokeStyle(1, color)
      .setDepth(2);

    // Room label
    this.labelText = scene.add
      .text(x, y + 28, label, {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#' + color.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5)
      .setDepth(2);

    // Physics zone for overlap detection
    this.zone = scene.add.zone(x, y, 128, 96);
    scene.physics.add.existing(this.zone, true);
  }

  setPlayerInside(inside: boolean): void {
    if (inside === this.isPlayerInside) return;
    this.isPlayerInside = inside;

    if (inside) {
      this.border.setStrokeStyle(2, COLORS.panelBorderLight, 1);
    } else {
      this.border.setStrokeStyle(2, this.icon.strokeColor, 0.7);
    }
  }
}
