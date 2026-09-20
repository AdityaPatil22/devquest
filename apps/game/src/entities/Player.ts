import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';

export const PLAYER_ATLAS_KEY = 'player-ash';
export const PLAYER_ATLAS_PATH = 'assets/character/ash.png';
export const PLAYER_ATLAS_JSON = 'assets/character/ash.json';

const IDLE_FRAMES = Array.from(
  { length: 24 },
  (_, i) => `Ash_idle_anim_${i + 1}.png`,
);

const RUN_FRAMES = Array.from(
  { length: 24 },
  (_, i) => `Ash_run_${i + 1}.png`,
);

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;

  private isMoving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(
      x,
      y,
      PLAYER_ATLAS_KEY,
      IDLE_FRAMES[0],
    );
  
    this.sprite.setDepth(5);
  
    // Prevent any rotation
    this.sprite.setRotation(0);
  
    this.sprite.setCollideWorldBounds(true);
  
    this.sprite.setScale(1);
  
    this.sprite.body!.setSize(16, 12);
    this.sprite.body!.setOffset(8, 32);
  
    this.sprite.play(IDLE_FRAMES[0]);
  }

  static createAnimations(scene: Phaser.Scene): void {
    scene.anims.create({
      key: 'player-idle-anim',
      frames: scene.anims.generateFrameNames(PLAYER_ATLAS_KEY, {
        prefix: 'Ash_idle_anim_',
        start: 1,
        end: 24,
        suffix: '.png',
      }),
      frameRate: 8,
      repeat: -1,
    });
  
    scene.anims.create({
      key: 'player-walk-anim',
      frames: scene.anims.generateFrameNames(PLAYER_ATLAS_KEY, {
        prefix: 'Ash_run_',
        start: 1,
        end: 24,
        suffix: '.png',
      }),
      frameRate: 12,
      repeat: -1,
    });
  }

  handleMovement(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  ): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(0);

    let moving = false;

    if (cursors.left.isDown) {
      body.setVelocityX(-PLAYER_SPEED);
      this.sprite.setFlipX(true);
      moving = true;
    } else if (cursors.right.isDown) {
      body.setVelocityX(PLAYER_SPEED);
      this.sprite.setFlipX(false);
      moving = true;
    }

    if (cursors.up.isDown) {
      body.setVelocityY(-PLAYER_SPEED);
      moving = true;
    } else if (cursors.down.isDown) {
      body.setVelocityY(PLAYER_SPEED);
      moving = true;
    }

    if (body.velocity.x !== 0 && body.velocity.y !== 0) {
      body.velocity.normalize().scale(PLAYER_SPEED);
    }

    if (moving && !this.isMoving) {
      this.sprite.play('player-walk-anim');
      this.isMoving = true;
    } else if (!moving && this.isMoving) {
      this.sprite.stop();
      this.sprite.setFrame(IDLE_FRAMES[0]);
      this.isMoving = false;
    }
  }

  stop(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(0);

    if (this.isMoving) {
      this.sprite.play('player-idle-anim');
      this.isMoving = false;
    }
  }
}