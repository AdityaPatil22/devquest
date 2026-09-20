import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';
import {
  TILEMAP_KEY,
  MAP_TILESETS,
  MAP_TILE_SIZE,
  COLLIDABLE_OBJECT_LAYERS,
  DECOR_OBJECT_LAYERS,
  SPAWN_TILE,
  GATE_TILE,
} from '../tilemap';

/**
 * Common Room — the hub. Rendered directly from the hand-authored Tiled map
 * (public/assets/map/map.json) instead of procedurally-generated tiles.
 */
export class CommonRoomScene extends Phaser.Scene {
  private player!: Player;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private promptText?: Phaser.GameObjects.Text;
  private nearGate = false;
  private gateX = 0;
  private gateY = 0;
  private gateIndicator?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CommonRoomScene' });
  }

  create(): void {
    this.walls = this.physics.add.staticGroup();
    this.buildRoom();
    this.createUI();
    this.createPlayer();
    this.physics.add.collider(this.player.sprite, this.walls);
    if (this.groundLayer) {
      this.physics.add.collider(this.player.sprite, this.groundLayer);
    }
    this.setupInput();
  }

  update(): void {
    this.player.handleMovement(this.cursors);
    this.checkGateProximity();
  }

  private buildRoom(): void {
    this.map = this.make.tilemap({ key: TILEMAP_KEY });

    const tilesets = MAP_TILESETS.map((t) =>
      this.map.addTilesetImage(t.name, t.key),
    ).filter((t): t is Phaser.Tilemaps.Tileset => t !== null);

    this.groundLayer = this.map.createLayer('Ground', tilesets, 0, 0) ?? undefined;
    this.groundLayer?.setDepth(0);

    // Some walls/pillars are baked directly into the Ground tile layer
    // (not separate "Wall" objects) and flagged with a `collides` tile
    // property in the tileset. Without this, the player can walk straight
    // through them.
    this.groundLayer?.setCollisionByProperty({ collides: true });

    // Objects that should block the player (walls, desks, etc.)
    for (const layerName of COLLIDABLE_OBJECT_LAYERS) {
      const objects = this.map.createFromObjects(layerName, {
        classType: Phaser.GameObjects.Image,
      }) as Phaser.GameObjects.Image[];

      objects.forEach((obj) => {
        this.physics.add.existing(obj, true);
        obj.setDepth(5);
        this.walls.add(obj);
      });
    }

    // Pure decoration — chairs, computers, whiteboards, vending machines, etc.
    for (const layerName of DECOR_OBJECT_LAYERS) {
      const objects = this.map.createFromObjects(layerName, {
        classType: Phaser.GameObjects.Image,
      }) as Phaser.GameObjects.Image[];

      objects.forEach((obj) => obj.setDepth(4));
    }

    // World & camera bounds match the map's real pixel size
    const mapWidthPx = this.map.widthInPixels;
    const mapHeightPx = this.map.heightInPixels;
    this.physics.world.setBounds(0, 0, mapWidthPx, mapHeightPx);
    this.cameras.main.setBounds(0, 0, mapWidthPx, mapHeightPx);

    // ─── Gate marker, placed on a verified open tile ───
    this.gateX = GATE_TILE.x * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    this.gateY = GATE_TILE.y * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    const gateHighlight = this.add
      .rectangle(this.gateX, this.gateY, MAP_TILE_SIZE * 1.8, MAP_TILE_SIZE * 1.8, 0x4a9eff, 0.35)
      .setStrokeStyle(2, 0x4a9eff)
      .setDepth(3);

    const gateLabel = this.add
      .text(this.gateX, this.gateY - MAP_TILE_SIZE, 'GATE', {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.lg,
        color: COLORS.textHighlight,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.gateIndicator = this.add.container(0, 0, [gateHighlight, gateLabel]);

    this.tweens.add({
      targets: gateHighlight,
      alpha: { from: 0.2, to: 0.55 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
  }

  private createUI(): void {
    const HEADER_HEIGHT = 76;
    const FOOTER_HEIGHT = 40;

    // Dark HUD bars behind the text so it stays readable over the busy
    // tilemap, fixed to the camera (not the world) like the text itself.
    this.add
      .rectangle(GAME_WIDTH / 2, HEADER_HEIGHT / 2, GAME_WIDTH, HEADER_HEIGHT, 0x0a0a1a, 0.75)
      .setScrollFactor(0)
      .setDepth(98);

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - FOOTER_HEIGHT / 2, GAME_WIDTH, FOOTER_HEIGHT, 0x0a0a1a, 0.75)
      .setScrollFactor(0)
      .setDepth(98);

    this.add
      .text(GAME_WIDTH / 2, 24, 'DEVQUEST', {
        fontFamily: FONTS.pixel,
        fontSize: '24px',
        color: COLORS.textHighlight,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(GAME_WIDTH / 2, 56, 'Engineering Decision Simulator', {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.md,
        color: COLORS.textSecondary,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - FOOTER_HEIGHT / 2, 'Walk to the Gate and press E', {
        fontFamily: FONTS.pixel,
        fontSize: FONTS.size.sm,
        color: COLORS.textPrimary,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
  }

  private createPlayer(): void {
    const spawnX = SPAWN_TILE.x * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    const spawnY = SPAWN_TILE.y * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    this.player = new Player(this, spawnX, spawnY);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  private checkGateProximity(): void {
    const dist = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, this.gateX, this.gateY
    );

    if (dist < MAP_TILE_SIZE * 3) {
      if (!this.nearGate) {
        this.nearGate = true;
        this.showPrompt();
      }
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.triggerGateFeedback();
        this.scene.start('GateScene');
      }
    } else if (this.nearGate) {
      this.nearGate = false;
      this.hidePrompt();
    }
  }

  private showPrompt(): void {
    if (!this.promptText) {
      this.promptText = this.add.text(0, 0, '[E] INTERACT • GATE', {
        fontFamily: FONTS.pixel, fontSize: FONTS.size.md,
        color: COLORS.textPrimary,
        backgroundColor: '#1a1a2e',
        padding: { x: 8, y: 5 },
      }).setDepth(100);
    }
    this.promptText.setPosition(
      this.gateX - this.promptText.width / 2,
      this.gateY + MAP_TILE_SIZE * 2
    );
    this.promptText.setVisible(true);

    const highlight = this.gateIndicator?.first;
    if (highlight instanceof Phaser.GameObjects.Rectangle) {
      highlight.setStrokeStyle(3, COLORS.textHighlight);
      highlight.setFillStyle(0x4a9eff, 0.5);
    }
  }

  private triggerGateFeedback(): void {
    if (!this.gateIndicator) return;
    const highlight = this.gateIndicator.first;
    if (!(highlight instanceof Phaser.GameObjects.Rectangle)) return;

    this.tweens.killTweensOf(highlight);
    this.tweens.add({
      targets: highlight,
      scale: { from: 1, to: 1.25 },
      alpha: { from: 0.7, to: 0 },
      duration: 220,
      onComplete: () => highlight.setScale(1).setAlpha(0.35),
    });
  }

  private hidePrompt(): void {
    this.promptText?.setVisible(false);
    const highlight = this.gateIndicator?.first;
    if (highlight instanceof Phaser.GameObjects.Rectangle) {
      highlight.setStrokeStyle(2, 0x4a9eff);
      highlight.setFillStyle(0x4a9eff, 0.35);
    }
  }
}
