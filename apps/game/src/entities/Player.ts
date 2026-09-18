import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';

/** Spritesheet config */
export const PLAYER_SPRITE_PATH = 'assets/sprites/With_Shadows';

export const PLAYER_IDLE = {
  key: 'player-idle',
  path: `${PLAYER_SPRITE_PATH}/Human_Soldier_Sword_Shield_Idle-Sheet.png`,
  frameWidth: 96,
  frameHeight: 96,
  frames: 6,
};

export const PLAYER_WALK = {
  key: 'player-walk',
  path: `${PLAYER_SPRITE_PATH}/Human_Soldier_Sword_Shield_Walk-Sheet.png`,
  frameWidth: 96,
  frameHeight: 96,
  frames: 8,
};

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;

  private isMoving = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, PLAYER_IDLE.key);
    this.sprite.setDepth(5);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(2.5);

    this.sprite.body!.setSize(20, 20);
    this.sprite.body!.setOffset(38, 65);

    this.sprite.play('player-idle-anim');
  }

  /** Register animations — call once in BootScene */
  static createAnimations(scene: Phaser.Scene): void {
    scene.anims.create({
      key: 'player-idle-anim',
      frames: scene.anims.generateFrameNumbers(PLAYER_IDLE.key, {
        start: 0, end: PLAYER_IDLE.frames - 1,
      }),
      frameRate: 6,
      repeat: -1,
    });

    scene.anims.create({
      key: 'player-walk-anim',
      frames: scene.anims.generateFrameNumbers(PLAYER_WALK.key, {
        start: 0, end: PLAYER_WALK.frames - 1,
      }),
      frameRate: 8,
      repeat: -1,
    });
  }

  handleMovement(cursors: Phaser.Types.Input.Keyboard.CursorKeys): void {
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
      this.sprite.play('player-idle-anim');
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
