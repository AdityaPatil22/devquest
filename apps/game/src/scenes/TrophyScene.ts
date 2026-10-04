import Phaser from 'phaser';

import { Player } from '../entities/Player';
import { SessionStore } from '../state/SessionStore';

import {
  TROPHY_TILEMAP_KEY,
  TROPHY_TILESETS,
  TROPHY_MAP_TILE_SIZE,
  TROPHY_TILE_LAYERS,
  TROPHY_COLLIDABLE_LAYER,
  TROPHY_MAP_BOUNDS,
  TROPHY_SPAWN_TILE,
} from '../tilemaps/trophyRoomTilemap';

import { addTileLayers, findLayer, loadTilemap } from './support/tilemap';
import { createSceneKeys, emitUI } from './support/sceneUi';

interface SceneData {
  store: SessionStore;
}

const TROPHY_KEY = 'trophy';

const TROPHY_TILE = {
  x: 23.5,
  y: 12,
};

const TROPHY_INTERACTION_DISTANCE = TROPHY_MAP_TILE_SIZE * 2.5;

export class TrophyScene extends Phaser.Scene {
  private store!: SessionStore;

  private map!: Phaser.Tilemaps.Tilemap;

  private wallsLayer?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;

  private player!: Player;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private interactKey!: Phaser.Input.Keyboard.Key;

  private trophy!: Phaser.GameObjects.Image;

  private nearTrophy = false;

  /**
   * React currently owns the summary UI.
   *
   * This flag only tells Phaser whether
   * player movement should be paused.
   */
  private summaryOpen = false;

  constructor() {
    super({
      key: 'TrophyScene',
    });
  }

  init(data: SceneData): void {
    this.store = data.store;

    this.nearTrophy = false;
    this.summaryOpen = false;
  }

  create(): void {
    this.buildRoom();
    this.createPlayer();
    this.createTrophy();
    this.createInput();
  }

  private buildRoom(): void {
    const { map, tilesets } = loadTilemap(
      this,
      TROPHY_TILEMAP_KEY,
      TROPHY_TILESETS,
      TROPHY_MAP_TILE_SIZE,
    );

    this.map = map;

    const { layers } = addTileLayers(this, {
      layerNames: TROPHY_TILE_LAYERS,
      collidableLayer: TROPHY_COLLIDABLE_LAYER,
      create: (layerName) => map.createLayer(layerName, tilesets),
    });

    /* The collider is wired in createPlayer, once the player exists. */
    this.wallsLayer = findLayer(layers, TROPHY_COLLIDABLE_LAYER);

    const { minTileX, maxTileX, minTileY, maxTileY } = TROPHY_MAP_BOUNDS;

    const boundsX = minTileX * TROPHY_MAP_TILE_SIZE;

    const boundsY = minTileY * TROPHY_MAP_TILE_SIZE;

    const mapWidth = (maxTileX - minTileX + 1) * TROPHY_MAP_TILE_SIZE;

    const mapHeight = (maxTileY - minTileY + 1) * TROPHY_MAP_TILE_SIZE;

    this.physics.world.setBounds(boundsX, boundsY, mapWidth, mapHeight);

    /*
     * The map is smaller than the viewport,
     * so don't use camera bounds.
     */
    this.cameras.main.centerOn(boundsX + mapWidth / 2, boundsY + mapHeight / 2);

    this.cameras.main.stopFollow();
  }

  private createPlayer(): void {
    const spawnX = TROPHY_SPAWN_TILE.x * TROPHY_MAP_TILE_SIZE + TROPHY_MAP_TILE_SIZE / 2;

    const spawnY = TROPHY_SPAWN_TILE.y * TROPHY_MAP_TILE_SIZE + TROPHY_MAP_TILE_SIZE / 2;

    this.player = new Player(this, spawnX, spawnY);

    this.player.sprite.setCollideWorldBounds(true);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.2);


    if (this.wallsLayer) {
      this.physics.add.collider(this.player.sprite, this.wallsLayer);
    }
  }

  private createTrophy(): void {
    const trophyX = TROPHY_TILE.x * TROPHY_MAP_TILE_SIZE + TROPHY_MAP_TILE_SIZE / 2;

    const trophyY = TROPHY_TILE.y * TROPHY_MAP_TILE_SIZE + TROPHY_MAP_TILE_SIZE / 2;

    this.trophy = this.add
      .image(trophyX, trophyY, TROPHY_KEY)
      .setOrigin(0.5)
      .setDepth(8)
      .setScale(0.08);

    this.tweens.add({
      targets: this.trophy,
      y: trophyY - 2,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createInput(): void {
    if (!this.input.keyboard) {
      return;
    }

    ({ cursors: this.cursors, interact: this.interactKey } = createSceneKeys(this));
  }

  update(): void {
    if (!this.player || !this.cursors) {
      return;
    }

    /*
     * React summary is open.
     * Don't allow player movement.
     */
    if (this.summaryOpen) {
      this.player.stop();

      return;
    }

    this.player.handleMovement(this.cursors);

    this.checkTrophyProximity();
  }

  private checkTrophyProximity(): void {
    if (!this.trophy) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.sprite.x,
      this.player.sprite.y,
      this.trophy.x,
      this.trophy.y,
    );

    const isNear = distance <= TROPHY_INTERACTION_DISTANCE;

    /*
     * Player entered interaction range.
     */
    if (isNear && !this.nearTrophy) {
      this.nearTrophy = true;

      emitUI(this, {
        type: 'TROPHY_PROXIMITY',
        visible: true,
      });
    }

    /*
     * Player left interaction range.
     */
    if (!isNear && this.nearTrophy) {
      this.nearTrophy = false;

      emitUI(this, {
        type: 'TROPHY_PROXIMITY',
        visible: false,
      });
    }

    /*
     * Player pressed E while near trophy.
     */
    if (isNear && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.openSummary();
    }
  }

  private openSummary(): void {
    if (this.summaryOpen) {
      return;
    }

    this.summaryOpen = true;

    this.player.stop();

    emitUI(this, {
      type: 'TROPHY_INTERACTED',
      problem: this.store.problem,
      summary: this.store.summary,
      docContent: this.store.docContent,
    });
  }

  /**
   * Called by React when the summary
   * modal is closed.
   */
  public closeSummary(): void {
    this.summaryOpen = false;

    /*
     * Recalculate proximity so React can
     * display the prompt again if necessary.
     */
    const distance = Phaser.Math.Distance.Between(
      this.player.sprite.x,
      this.player.sprite.y,
      this.trophy.x,
      this.trophy.y,
    );

    const isNear = distance <= TROPHY_INTERACTION_DISTANCE;

    this.nearTrophy = isNear;

    emitUI(this, {
      type: 'TROPHY_PROXIMITY',
      visible: isNear,
    });
  }

  shutdown(): void {
    this.player?.stop();

    this.summaryOpen = false;

    emitUI(this, {
      type: 'TROPHY_PROXIMITY',
      visible: false,
    });
  }
}
