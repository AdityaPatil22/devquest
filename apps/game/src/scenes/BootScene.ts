import Phaser from 'phaser';

import {
  PATTERNS_KEY,
  PATTERNS_PATH,
  PATTERNS_CONFIG,
} from '../tiles';

import {
  TILEMAP_KEY,
  TILEMAP_PATH,
  MAP_TILESETS,
} from '../tilemaps/commonRoomTilemap';

import {
  DECISION_TILEMAP_KEY,
  DECISION_TILEMAP_PATH,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
} from '../tilemaps/decisionRoomTilemap';

import {
  GATE_TILEMAP_KEY,
  GATE_TILEMAP_PATH,
} from '../tilemaps/gateSceneTilemap';

import { Player } from '../entities/Player';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({
      key: 'BootScene',
    });
  }

  preload(): void {
    this.createLoadingBar();

    // ==================================================
    // Pattern tileset
    // ==================================================
    //
    // Still used by the Gate / Decision / Trophy scenes.
    //
    this.load.spritesheet(
      PATTERNS_KEY,
      PATTERNS_PATH,
      PATTERNS_CONFIG,
    );

    // ==================================================
    // Common Room
    // ==================================================

    this.load.tilemapTiledJSON(
      TILEMAP_KEY,
      TILEMAP_PATH,
    );

    /*
     * Common Room tilesets are loaded as spritesheets
     * because the Tiled map references individual frames.
     */
    MAP_TILESETS.forEach(
      ({
        key,
        path,
        frameWidth,
        frameHeight,
      }) => {
        this.load.spritesheet(key, path, {
          frameWidth,
          frameHeight,
          margin: 0,
          spacing: 0,
        });
      },
    );

    // ==================================================
    // Decision Room
    // ==================================================

    this.load.tilemapTiledJSON(
      DECISION_TILEMAP_KEY,
      DECISION_TILEMAP_PATH,
    );

    /*
     * Some Decision Room tilesets use the same texture
     * more than once. Prevent duplicate asset loads.
     */
    const seenKeys = new Set<string>();

    DECISION_TILESETS.forEach(
      ({
        key,
        path,
      }) => {
        if (seenKeys.has(key)) {
          return;
        }

        seenKeys.add(key);

        this.load.spritesheet(
          key,
          path,
          {
            frameWidth: DECISION_MAP_TILE_SIZE,
            frameHeight: DECISION_MAP_TILE_SIZE,
            margin: 0,
            spacing: 0,
          },
        );
      },
    );

    // ==================================================
    // Gate Scene
    // ==================================================

    /*
     * Gate Scene uses the already-loaded pattern tileset.
     * Only the Tiled map itself needs to be loaded here.
     */
    this.load.tilemapTiledJSON(
      GATE_TILEMAP_KEY,
      GATE_TILEMAP_PATH,
    );

    // ==================================================
    // Player
    // ==================================================

    /*
     * Load individual Ash PNG frames instead of the
     * TexturePacker atlas.
     *
     * Assets:
     *
     * public/assets/character/singular-frames/
     *
     * Ash_idle_anim_1.png ... Ash_idle_anim_24.png
     * Ash_run_1.png       ... Ash_run_24.png
     */
    Player.preload(this);
  }

  create(): void {
    /*
     * Create the player's directional walking
     * animations after all individual PNGs have loaded.
     */
    Player.createAnimations(this);

    /*
     * Start the game in the Common Room.
     */
    this.scene.start('CommonRoomScene');
  }

  private createLoadingBar(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const barWidth = 320;
    const barHeight = 20;

    // ==================================================
    // Loading bar outline
    // ==================================================

    this.add
      .rectangle(
        width / 2,
        height / 2,
        barWidth + 4,
        barHeight + 4,
      )
      .setStrokeStyle(
        2,
        0x4a9eff,
      );

    // ==================================================
    // Loading bar fill
    // ==================================================

    const fill = this.add
      .rectangle(
        width / 2 - barWidth / 2 + 2,
        height / 2,
        0,
        barHeight,
        0x4a9eff,
      )
      .setOrigin(
        0,
        0.5,
      );

    // ==================================================
    // Loading text
    // ==================================================

    this.add
      .text(
        width / 2,
        height / 2 - 24,
        'LOADING...',
        {
          fontFamily: '"Press Start 2P"',
          fontSize: '12px',
          color: '#4a9eff',
        },
      )
      .setOrigin(0.5);

    // ==================================================
    // Loading progress
    // ==================================================

    this.load.on(
      'progress',
      (value: number) => {
        fill.width = barWidth * value;
      },
    );
  }
}