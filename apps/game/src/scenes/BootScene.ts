import Phaser from 'phaser';
import { PATTERNS_KEY, PATTERNS_PATH, PATTERNS_CONFIG } from '../tiles';
import { Player, PLAYER_IDLE, PLAYER_WALK } from '../entities/Player';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingBar();

    // Pattern tileset
    this.load.spritesheet(PATTERNS_KEY, PATTERNS_PATH, PATTERNS_CONFIG);

    // Player spritesheets
    this.load.spritesheet(PLAYER_IDLE.key, PLAYER_IDLE.path, {
      frameWidth: PLAYER_IDLE.frameWidth,
      frameHeight: PLAYER_IDLE.frameHeight,
    });
    this.load.spritesheet(PLAYER_WALK.key, PLAYER_WALK.path, {
      frameWidth: PLAYER_WALK.frameWidth,
      frameHeight: PLAYER_WALK.frameHeight,
    });
  }

  create(): void {
    Player.createAnimations(this);
    this.scene.start('CommonRoomScene');
  }

  private createLoadingBar(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const barW = 320;

    this.add.rectangle(w / 2, h / 2, barW + 4, 24).setStrokeStyle(2, 0x4a9eff);
    const fill = this.add.rectangle(w / 2 - barW / 2 + 2, h / 2, 0, 20, 0x4a9eff).setOrigin(0, 0.5);
    this.add.text(w / 2, h / 2 - 24, 'LOADING...', {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#4a9eff',
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => { fill.width = barW * v; });
  }
}
