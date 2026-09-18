import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setDepth(5);
    this.sprite.setCollideWorldBounds(true);

    // Scale up 16x16 sprite for visibility
    this.sprite.setScale(2);
    this.sprite.body!.setSize(16, 16);
  }

  handleMovement(cursors: Phaser.Types.Input.Keyboard.CursorKeys): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    if (cursors.left.isDown) {
      body.setVelocityX(-PLAYER_SPEED);
    } else if (cursors.right.isDown) {
      body.setVelocityX(PLAYER_SPEED);
    }

    if (cursors.up.isDown) {
      body.setVelocityY(-PLAYER_SPEED);
    } else if (cursors.down.isDown) {
      body.setVelocityY(PLAYER_SPEED);
    }

    // Normalize diagonal movement
    if (body.velocity.x !== 0 && body.velocity.y !== 0) {
      body.velocity.normalize().scale(PLAYER_SPEED);
    }
  }

  stop(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);
  }
}
