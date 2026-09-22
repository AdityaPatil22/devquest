import Phaser from 'phaser';
import { PLAYER_SPEED } from '../config';

const PLAYER_ASSET_PATH = 'assets/character/singular-frames';

const IDLE_FRAME = 'player-idle-19';

// Start with these groups.
// If the visual orientation is different in your sprite sheet,
// only these arrays need to change.
const WALK_DOWN = [
  'player-run-19',
  'player-run-20',
  'player-run-21',
  'player-run-22',
  'player-run-23',
  'player-run-24',
];

const WALK_LEFT = [
  'player-run-13',
  'player-run-14',
  'player-run-15',
  'player-run-16',
  'player-run-17',
  'player-run-18',
];

const WALK_RIGHT = [
  'player-run-1',
  'player-run-2',
  'player-run-3',
  'player-run-4',
  'player-run-5',
  'player-run-6',
];

const WALK_UP = [
  'player-run-7',
  'player-run-8',
  'player-run-9',
  'player-run-10',
  'player-run-11',
  'player-run-12',
];

type Direction = 'up' | 'down' | 'left' | 'right';

export class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;

  private isMoving = false;
  private direction: Direction = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, IDLE_FRAME);

    this.sprite.setDepth(5);
    this.sprite.setRotation(0);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(1);

    this.sprite.body!.setSize(16, 12);
    this.sprite.body!.setOffset(8, 32);

    // Never flip the sprite.
    // Each direction has its own animation.
    this.sprite.setFlipX(false);

    this.sprite.setTexture(IDLE_FRAME);
  }

  static preload(scene: Phaser.Scene): void {
    // Idle frames
    for (let i = 1; i <= 24; i++) {
      scene.load.image(`player-idle-${i}`, `${PLAYER_ASSET_PATH}/Ash_idle_anim_${i}.png`);
    }

    // Run frames
    for (let i = 1; i <= 24; i++) {
      scene.load.image(`player-run-${i}`, `${PLAYER_ASSET_PATH}/Ash_run_${i}.png`);
    }
  }

  static createAnimations(scene: Phaser.Scene): void {
    Player.createAnimation(scene, 'player-walk-down', WALK_DOWN);

    Player.createAnimation(scene, 'player-walk-left', WALK_LEFT);

    Player.createAnimation(scene, 'player-walk-right', WALK_RIGHT);

    Player.createAnimation(scene, 'player-walk-up', WALK_UP);
  }

  private static createAnimation(scene: Phaser.Scene, key: string, frames: string[]): void {
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({
        key: frame,
      })),
      frameRate: 10,
      repeat: -1,
    });
  }

  handleMovement(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd?: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key },
  ): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const up = cursors.up.isDown || Boolean(wasd?.up.isDown);
    const down = cursors.down.isDown || Boolean(wasd?.down.isDown);
    const left = cursors.left.isDown || Boolean(wasd?.left.isDown);
    const right = cursors.right.isDown || Boolean(wasd?.right.isDown);

    body.setVelocity(0);

    let moving = false;

    /*
     * Horizontal movement
     */
    if (left) {
      body.setVelocityX(-PLAYER_SPEED);

      this.direction = 'left';
      moving = true;
    } else if (right) {
      body.setVelocityX(PLAYER_SPEED);

      this.direction = 'right';
      moving = true;
    }

    /*
     * Vertical movement
     */
    if (up) {
      body.setVelocityY(-PLAYER_SPEED);

      this.direction = 'up';
      moving = true;
    } else if (down) {
      body.setVelocityY(PLAYER_SPEED);

      this.direction = 'down';
      moving = true;
    }

    /*
     * Normalize diagonal movement.
     */
    if (body.velocity.x !== 0 && body.velocity.y !== 0) {
      body.velocity.normalize().scale(PLAYER_SPEED);
    }

    /*
     * Start the correct animation.
     */
    if (moving) {
      this.playWalkAnimation();
      this.isMoving = true;
    } else if (this.isMoving) {
      this.stopWalking();
    }
  }

  private playWalkAnimation(): void {
    const animationKey = `player-walk-${this.direction}`;

    if (this.sprite.anims.currentAnim?.key !== animationKey) {
      this.sprite.play(animationKey);
    }
  }

  private stopWalking(): void {
    this.sprite.stop();

    // Always face forward when idle.
    this.sprite.setTexture(IDLE_FRAME);

    // Never rotate.
    this.sprite.setRotation(0);

    this.sprite.setFlipX(false);

    this.isMoving = false;
  }

  stop(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(0);

    this.stopWalking();
  }
}
