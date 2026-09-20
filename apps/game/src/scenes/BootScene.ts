import Phaser from 'phaser';
import { PATTERNS_KEY, PATTERNS_PATH, PATTERNS_CONFIG } from '../tiles';
import { TILEMAP_KEY, TILEMAP_PATH, MAP_TILESETS } from '../tilemap';
import {
  DECISION_TILEMAP_KEY,
  DECISION_TILEMAP_PATH,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
} from '../decisionRoomTilemap';
import {
  Player,
  PLAYER_ATLAS_KEY,
  PLAYER_ATLAS_PATH,
  PLAYER_ATLAS_JSON,
} from '../entities/Player';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    this.createLoadingBar();

    // Pattern tileset (still used by Gate / Decision / Trophy scenes)
    this.load.spritesheet(
      PATTERNS_KEY,
      PATTERNS_PATH,
      PATTERNS_CONFIG,
    );

    // Common Room world map (Tiled JSON) + its tileset images.
    // Loaded as spritesheets (not plain images) so each tile gets its own
    // numbered frame — required for object-layer furniture to render
    // correctly via createFromObjects.
    this.load.tilemapTiledJSON(TILEMAP_KEY, TILEMAP_PATH);
    MAP_TILESETS.forEach(({ key, path, frameWidth, frameHeight }) => {
      this.load.spritesheet(key, path, {
        frameWidth,
        frameHeight,
        margin: 0,
        spacing: 0,
      });
    });

    // Decision Room world map (Tiled JSON) + its tileset images.
    // Its tilesets are only referenced as external .tsx files in the JSON
    // (Phaser can't load those), so we separately load the same shared
    // images at 16×16 frames here and patch the tileset data at runtime —
    // see decisionRoomTilemap.ts for details.
    this.load.tilemapTiledJSON(DECISION_TILEMAP_KEY, DECISION_TILEMAP_PATH);
    DECISION_TILESETS.forEach(({ key, path }) => {
      this.load.spritesheet(key, path, {
        frameWidth: DECISION_MAP_TILE_SIZE,
        frameHeight: DECISION_MAP_TILE_SIZE,
        margin: 0,
        spacing: 0,
      });
    });

    // Ash character atlas
    this.load.atlas(
      PLAYER_ATLAS_KEY,
      PLAYER_ATLAS_PATH,
      PLAYER_ATLAS_JSON,
    );
  }

  create(): void {
    Player.createAnimations(this);
    this.scene.start('CommonRoomScene');
  }

  private createLoadingBar(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const barW = 320;

    this.add
      .rectangle(w / 2, h / 2, barW + 4, 24)
      .setStrokeStyle(2, 0x4a9eff);

    const fill = this.add
      .rectangle(
        w / 2 - barW / 2 + 2,
        h / 2,
        0,
        20,
        0x4a9eff,
      )
      .setOrigin(0, 0.5);

    this.add
      .text(w / 2, h / 2 - 24, 'LOADING...', {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#4a9eff',
      })
      .setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      fill.width = barW * v;
    });
  }
}