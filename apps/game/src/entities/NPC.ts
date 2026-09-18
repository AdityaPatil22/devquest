import Phaser from 'phaser';

export class NPC {
  public sprite: Phaser.GameObjects.Sprite;
  public name: string;
  public role: string;

  private nameText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    role: string
  ) {
    this.name = name;
    this.role = role;

    this.sprite = scene.add.sprite(x, y, 'npc');
    this.sprite.setDepth(5);
    this.sprite.setScale(2);

    this.nameText = scene.add
      .text(x, y - 24, name, {
        fontFamily: '"Press Start 2P"',
        fontSize: '6px',
        color: '#aa44ff',
      })
      .setOrigin(0.5)
      .setDepth(6);

    // Idle bob animation
    scene.tweens.add({
      targets: this.sprite,
      y: y - 2,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
