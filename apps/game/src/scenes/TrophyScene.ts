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
  patchTrophyRoomTilesets,
} from '../tilemaps/trophyRoomTilemap';

interface SceneData {
  store: SessionStore;
}

// ─────────────────────────────────────────────
// Trophy
// ─────────────────────────────────────────────

const TROPHY_KEY = 'trophy';

/**
 * Position of the trophy on the center table.
 *
 * Adjust these two values if the trophy needs
 * to move slightly on your Tiled map.
 */
const TROPHY_TILE = {
  x: 23.5,
  y: 11.7,
};

/**
 * Player interaction distance.
 */
const TROPHY_INTERACTION_DISTANCE =
  TROPHY_MAP_TILE_SIZE * 2.5;

export class TrophyScene extends Phaser.Scene {
  // ─────────────────────────────────────────────
  // Session
  // ─────────────────────────────────────────────

  private store!: SessionStore;

  // ─────────────────────────────────────────────
  // Map
  // ─────────────────────────────────────────────

  private map!: Phaser.Tilemaps.Tilemap;

  private wallsLayer?: ReturnType<
    Phaser.Tilemaps.Tilemap['createLayer']
  >;

  // ─────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────

  private player!: Player;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private interactKey!: Phaser.Input.Keyboard.Key;

  private escapeKey!: Phaser.Input.Keyboard.Key;

  // ─────────────────────────────────────────────
  // Trophy
  // ─────────────────────────────────────────────

  private trophy!: Phaser.GameObjects.Image;

  private nearTrophy = false;

  private summaryOpen = false;

  // ─────────────────────────────────────────────
  // Summary UI
  // ─────────────────────────────────────────────

  private summaryContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({
      key: 'TrophyScene',
    });
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────

  init(data: SceneData): void {
    this.store = data.store;

    this.nearTrophy = false;

    this.summaryOpen = false;
  }

  // ─────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────

  create(): void {
    this.buildRoom();

    this.createPlayer();

    this.createTrophy();

    this.createInput();
  }

  // ─────────────────────────────────────────────
  // Map
  // ─────────────────────────────────────────────

  private buildRoom(): void {
    const cached =
      this.cache.tilemap.get(
        TROPHY_TILEMAP_KEY,
      );

    if (cached?.data) {
      patchTrophyRoomTilesets(
        cached.data,
      );
    }

    this.map = this.make.tilemap({
      key: TROPHY_TILEMAP_KEY,
    });

    const tilesets =
      TROPHY_TILESETS.map(
        (tileset) =>
          this.map.addTilesetImage(
            tileset.name,
            tileset.key,
          ),
      ).filter(
        (
          tileset,
        ): tileset is Phaser.Tilemaps.Tileset =>
          tileset !== null,
      );

    // ───────────────────────────────────────
    // Tiled layers
    // ───────────────────────────────────────

    TROPHY_TILE_LAYERS.forEach(
      (layerName, depth) => {
        const layer =
          this.map.createLayer(
            layerName,
            tilesets,
          );

        if (!layer) {
          console.warn(
            `TrophyScene: unable to create layer "${layerName}"`,
          );

          return;
        }

        layer.setDepth(depth);

        if (
          layerName ===
          TROPHY_COLLIDABLE_LAYER
        ) {
          layer.setCollisionByExclusion([
            -1,
          ]);

          this.wallsLayer = layer;
        }
      },
    );

    // ───────────────────────────────────────
    // World bounds
    // ───────────────────────────────────────

    const {
      minTileX,
      maxTileX,
      minTileY,
      maxTileY,
    } = TROPHY_MAP_BOUNDS;

    const boundsX =
      minTileX *
      TROPHY_MAP_TILE_SIZE;

    const boundsY =
      minTileY *
      TROPHY_MAP_TILE_SIZE;

    const mapWidth =
      (maxTileX - minTileX + 1) *
      TROPHY_MAP_TILE_SIZE;

    const mapHeight =
      (maxTileY - minTileY + 1) *
      TROPHY_MAP_TILE_SIZE;

    this.physics.world.setBounds(
      boundsX,
      boundsY,
      mapWidth,
      mapHeight,
    );

    // ───────────────────────────────────────
    // Center map
    // ───────────────────────────────────────

    const mapCenterX =
      boundsX + mapWidth / 2;

    const mapCenterY =
      boundsY + mapHeight / 2;

    /*
     * Do not use camera bounds here because
     * the map is smaller than the viewport.
     */
    this.cameras.main.centerOn(
      mapCenterX,
      mapCenterY,
    );

    this.cameras.main.stopFollow();
  }

  // ─────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────

  private createPlayer(): void {
    const spawnX =
      TROPHY_SPAWN_TILE.x *
        TROPHY_MAP_TILE_SIZE +
      TROPHY_MAP_TILE_SIZE / 2;

    const spawnY =
      TROPHY_SPAWN_TILE.y *
        TROPHY_MAP_TILE_SIZE +
      TROPHY_MAP_TILE_SIZE / 2;

    this.player = new Player(
      this,
      spawnX,
      spawnY,
    );

    this.player.sprite.setCollideWorldBounds(
      true,
    );

    if (this.wallsLayer) {
      this.physics.add.collider(
        this.player.sprite,
        this.wallsLayer,
      );
    }
  }

  // ─────────────────────────────────────────────
  // Trophy
  // ─────────────────────────────────────────────

  private createTrophy(): void {
    const trophyX =
      TROPHY_TILE.x *
        TROPHY_MAP_TILE_SIZE +
      TROPHY_MAP_TILE_SIZE / 2;

    const trophyY =
      TROPHY_TILE.y *
        TROPHY_MAP_TILE_SIZE +
      TROPHY_MAP_TILE_SIZE / 2;

    this.trophy = this.add
      .image(
        trophyX,
        trophyY,
        TROPHY_KEY,
      )
      .setOrigin(0.5)
      .setDepth(8);

    /*
     * Adjust the trophy size depending on
     * the actual PNG dimensions.
     *
     * Start with 0.8 and adjust if necessary.
     */
    this.trophy.setScale(0.08);

    /*
     * Small floating animation to make the
     * trophy feel interactive.
     */
    this.tweens.add({
      targets: this.trophy,
      y: trophyY - 2,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ─────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────

  private createInput(): void {
    if (!this.input.keyboard) {
      return;
    }

    this.cursors =
      this.input.keyboard.createCursorKeys();

    this.interactKey =
      this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.E,
      );

    this.escapeKey =
      this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC,
      );
  }

  // ─────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────

  update(): void {
    if (!this.player || !this.cursors) {
      return;
    }

    /*
     * When the summary is open, don't allow
     * the player to move.
     */
    if (this.summaryOpen) {
      this.player.stop();

      if (
        Phaser.Input.Keyboard.JustDown(
          this.interactKey,
        ) ||
        Phaser.Input.Keyboard.JustDown(
          this.escapeKey,
        )
      ) {
        this.closeSummary();
      }

      return;
    }

    this.player.handleMovement(
      this.cursors,
    );

    this.checkTrophyProximity();
  }

  // ─────────────────────────────────────────────
  // Trophy proximity
  // ─────────────────────────────────────────────

  private checkTrophyProximity(): void {
    if (!this.trophy) {
      return;
    }

    const distance =
      Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        this.trophy.x,
        this.trophy.y,
      );

    const isNear =
      distance <=
      TROPHY_INTERACTION_DISTANCE;

    if (isNear && !this.nearTrophy) {
      this.nearTrophy = true;

      this.showInteractionHint();
    }

    if (!isNear && this.nearTrophy) {
      this.nearTrophy = false;

      this.hideInteractionHint();
    }

    if (
      isNear &&
      Phaser.Input.Keyboard.JustDown(
        this.interactKey,
      )
    ) {
      this.openSummary();
    }
  }

  // ─────────────────────────────────────────────
  // Interaction hint
  // ─────────────────────────────────────────────

  private interactionHint?: Phaser.GameObjects.Text;

  private showInteractionHint(): void {
    if (this.interactionHint) {
      return;
    }

    this.interactionHint = this.add
      .text(
        this.trophy.x,
        this.trophy.y - 30,
        'PRESS E TO VIEW SUMMARY',
        {
          fontSize: '10px',
          color: '#ffffff',
          backgroundColor: '#111827',
          padding: {
            left: 8,
            right: 8,
            top: 5,
            bottom: 5,
          },
        },
      )
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets:
        this.interactionHint,
      alpha: {
        from: 0.6,
        to: 1,
      },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private hideInteractionHint(): void {
    this.interactionHint?.destroy();

    this.interactionHint =
      undefined;
  }

  // ─────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────

  private openSummary(): void {
    if (this.summaryOpen) {
      return;
    }

    this.summaryOpen = true;

    this.player.stop();

    this.hideInteractionHint();

    this.createSummaryPanel();
  }

  private createSummaryPanel(): void {
    const width =
      Math.min(
        this.scale.width - 80,
        900,
      );

    const height =
      Math.min(
        this.scale.height - 80,
        650,
      );

    const centerX =
      this.scale.width / 2;

    const centerY =
      this.scale.height / 2;

    this.summaryContainer =
      this.add.container(
        centerX,
        centerY,
      );

    this.summaryContainer.setDepth(
      100,
    );

    this.summaryContainer.setScrollFactor(
      0,
    );

    // ─────────────────────────────────────
    // Background
    // ─────────────────────────────────────

    const background =
      this.add.rectangle(
        0,
        0,
        width,
        height,
        0x111827,
        0.97,
      );

    background.setStrokeStyle(
      2,
      0xffffff,
      0.8,
    );

    this.summaryContainer.add(
      background,
    );

    // ─────────────────────────────────────
    // Title
    // ─────────────────────────────────────

    const title =
      this.add.text(
        0,
        -height / 2 + 35,
        'SESSION SUMMARY',
        {
          fontSize: '24px',
          color: '#ffffff',
          fontStyle: 'bold',
        },
      );

    title.setOrigin(0.5);

    this.summaryContainer.add(
      title,
    );

    // ─────────────────────────────────────
    // Content
    // ─────────────────────────────────────

    const contentParts: string[] = [];

    // Problem

    if (this.store.problem) {
      contentParts.push(
        `PROBLEM\n${this.store.problem}`,
      );
    }

    // Summary

    if (this.store.summary) {
      contentParts.push(
        `SUMMARY\n${this.store.summary}`,
      );
    }

    // Decisions

    if (this.store.decisions.length > 0) {
      const decisions =
        this.store.decisions
          .map((decision, index) => {
            const selected =
              decision.options.find(
                (option) =>
                  option.id ===
                  decision.selectedOptionId,
              );

            const selectedText =
              selected?.label ??
              decision.selectedOptionId ??
              'No selection';

            return (
              `Round ${index + 1}\n` +
              `${decision.question}\n` +
              `Decision: ${selectedText}`
            );
          })
          .join('\n\n');

      contentParts.push(
        `DECISIONS\n${decisions}`,
      );
    }

    // Document

    if (this.store.docContent) {
      contentParts.push(
        `DECISION DOCUMENT\n${this.store.docContent}`,
      );
    }

    const content =
      contentParts.join(
        '\n\n────────────────────\n\n',
      );

    // ─────────────────────────────────────
    // Scrollable content
    // ─────────────────────────────────────

    const contentText =
      this.add.text(
        -width / 2 + 35,
        -height / 2 + 80,
        content ||
          'No session summary available.',
        {
          fontSize: '13px',
          color: '#e5e7eb',
          lineSpacing: 8,
          wordWrap: {
            width: width - 70,
          },
        },
      );

    contentText.setOrigin(
      0,
      0,
    );

    this.summaryContainer.add(
      contentText,
    );

    // ─────────────────────────────────────
    // Close instruction
    // ─────────────────────────────────────

    const closeText =
      this.add.text(
        0,
        height / 2 - 30,
        'PRESS E OR ESC TO CLOSE',
        {
          fontSize: '11px',
          color: '#9ca3af',
        },
      );

    closeText.setOrigin(0.5);

    this.summaryContainer.add(
      closeText,
    );
  }

  // ─────────────────────────────────────────────
  // Close summary
  // ─────────────────────────────────────────────

  private closeSummary(): void {
    if (!this.summaryOpen) {
      return;
    }

    this.summaryOpen = false;

    this.summaryContainer?.destroy();

    this.summaryContainer =
      undefined;

    /*
     * Re-check proximity so the
     * interaction hint comes back.
     */
    this.checkTrophyProximity();
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  shutdown(): void {
    this.player?.stop();

    this.summaryContainer?.destroy();

    this.summaryContainer =
      undefined;

    this.interactionHint?.destroy();

    this.interactionHint =
      undefined;
  }
}