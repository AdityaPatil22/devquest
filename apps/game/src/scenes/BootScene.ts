import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingBar();

    // Placeholder: load tileset and spritesheet assets here
    // this.load.image('office-tiles', 'assets/tilesets/office.png');
    // this.load.tilemapTiledJSON('office-map', 'assets/tilesets/office.tmj');
    // this.load.spritesheet('player', 'assets/sprites/player.png', {
    //   frameWidth: 16,
    //   frameHeight: 16,
    // });
    // this.load.spritesheet('npc-architect', 'assets/sprites/npc-architect.png', {
    //   frameWidth: 16,
    //   frameHeight: 16,
    // });
  }

  create(): void {
    this.createPlaceholderTextures();
    this.scene.start('OfficeScene');
  }

  private createLoadingBar(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const barWidth = 320;
    const barHeight = 20;
    const barX = (width - barWidth) / 2;
    const barY = (height - barHeight) / 2;

    const border = this.add.rectangle(
      width / 2, barY + barHeight / 2,
      barWidth + 4, barHeight + 4,
      0x4a9eff
    );
    border.setStrokeStyle(2, 0x4a9eff);

    const fill = this.add.rectangle(
      barX + 2, barY + 2,
      0, barHeight,
      0x4a9eff
    );
    fill.setOrigin(0, 0);

    const text = this.add.text(width / 2, barY - 24, 'LOADING...', {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#4a9eff',
    });
    text.setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = barWidth * value;
    });
  }

  /** Generate colored rectangle textures until real art is ready */
  private createPlaceholderTextures(): void {
    // Player: blue square
    const playerGfx = this.add.graphics();
    playerGfx.fillStyle(0x4a9eff);
    playerGfx.fillRect(0, 0, 16, 16);
    playerGfx.generateTexture('player', 16, 16);
    playerGfx.destroy();

    // NPC: purple square
    const npcGfx = this.add.graphics();
    npcGfx.fillStyle(0xaa44ff);
    npcGfx.fillRect(0, 0, 16, 16);
    npcGfx.generateTexture('npc', 16, 16);
    npcGfx.destroy();

    // Interaction zone: semi-transparent yellow
    const zoneGfx = this.add.graphics();
    zoneGfx.fillStyle(0xffaa44, 0.3);
    zoneGfx.fillRect(0, 0, 48, 48);
    zoneGfx.generateTexture('zone-highlight', 48, 48);
    zoneGfx.destroy();

    // Floor tile
    const floorGfx = this.add.graphics();
    floorGfx.fillStyle(0x1a1a2e);
    floorGfx.fillRect(0, 0, 16, 16);
    floorGfx.lineStyle(1, 0x2a2a4e, 0.5);
    floorGfx.strokeRect(0, 0, 16, 16);
    floorGfx.generateTexture('floor', 16, 16);
    floorGfx.destroy();

    // Wall tile
    const wallGfx = this.add.graphics();
    wallGfx.fillStyle(0x2a2a4e);
    wallGfx.fillRect(0, 0, 16, 16);
    wallGfx.lineStyle(1, 0x3a3a6e);
    wallGfx.strokeRect(0, 0, 16, 16);
    wallGfx.generateTexture('wall', 16, 16);
    wallGfx.destroy();
  }
}
