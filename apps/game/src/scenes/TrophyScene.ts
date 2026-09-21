import Phaser from 'phaser';

import { SessionStore } from '../state/SessionStore';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';

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

interface TrophySceneData {
  problem: string;
  decision: string;
  summary: string;
}

export class TrophyScene extends Phaser.Scene {
  private store!: SessionStore;
  private trophyData!: TrophySceneData;

  private map!: Phaser.Tilemaps.Tilemap;

  private wallsLayer?: ReturnType<
    Phaser.Tilemaps.Tilemap['createLayer']
  >;

  constructor() {
    super({
      key: 'TrophyScene',
    });
  }

  init(data: SceneData): void {
    this.store = data.store;
  }
  

  create(): void {
    this.buildRoom();
    this.showTrophy();
  }

  private buildRoom(): void {
    const cached = this.cache.tilemap.get(TROPHY_TILEMAP_KEY);

    if (cached?.data) {
      patchTrophyRoomTilesets(cached.data);
    }

    this.map = this.make.tilemap({
      key: TROPHY_TILEMAP_KEY,
    });

    const tilesets = TROPHY_TILESETS.map((t) =>
      this.map.addTilesetImage(t.name, t.key),
    ).filter(
      (t): t is Phaser.Tilemaps.Tileset => t !== null,
    );

    TROPHY_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = this.map.createLayer(
        layerName,
        tilesets,
      );

      layer?.setDepth(depth);

      if (layerName === TROPHY_COLLIDABLE_LAYER) {
        layer?.setCollisionByExclusion([-1]);

        this.wallsLayer = layer ?? undefined;
      }
    });

    const {
      minTileX,
      maxTileX,
      minTileY,
      maxTileY,
    } = TROPHY_MAP_BOUNDS;

    const boundsX =
      minTileX * TROPHY_MAP_TILE_SIZE;

    const boundsY =
      minTileY * TROPHY_MAP_TILE_SIZE;

    const boundsWidthPx =
      (maxTileX - minTileX + 1) *
      TROPHY_MAP_TILE_SIZE;

    const boundsHeightPx =
      (maxTileY - minTileY + 1) *
      TROPHY_MAP_TILE_SIZE;

    this.physics.world.setBounds(
      boundsX,
      boundsY,
      boundsWidthPx,
      boundsHeightPx,
    );

    this.cameras.main.centerOn(
      boundsX + boundsWidthPx / 2,
      boundsY + boundsHeightPx / 2,
    );
  }

  private showTrophy(): void {
    this.add
      .text(GAME_WIDTH / 2, 60, '🏆', {
        fontSize: '48px',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(
        GAME_WIDTH / 2,
        120,
        'SESSION COMPLETE',
        {
          fontFamily: FONTS.pixel,
          fontSize: '18px',
          color: COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(
        GAME_WIDTH / 2,
        170,
        `"${this.store.problem}"`,
        {
          fontFamily: FONTS.pixel,
          fontSize: FONTS.size.md,
          color: COLORS.textSecondary,
          wordWrap: {
            width: GAME_WIDTH - 100,
          },
          align: 'center',
          fontStyle: 'italic',
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(10);

    const panelY = 240;

    this.add
      .rectangle(
        GAME_WIDTH / 2,
        panelY + 100,
        600,
        220,
        COLORS.panelBg,
        0.9,
      )
      .setStrokeStyle(
        2,
        COLORS.panelBorder,
      )
      .setDepth(9);

    this.add
      .text(
        GAME_WIDTH / 2,
        panelY + 10,
        'DECISIONS MADE',
        {
          fontFamily: FONTS.pixel,
          fontSize: FONTS.size.lg,
          color: COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);

    const decisions =
      this.store.decisions.filter(
        (d) => d.selectedOptionId,
      );

    const startY = panelY + 40;

    decisions.forEach((d, i) => {
      const selectedLabel =
        d.options.find(
          (o) => o.id === d.selectedOptionId,
        )?.label ?? '?';

      const text =
        `${d.selectedOptionId}. ${selectedLabel}`;

      this.add
        .text(
          220,
          startY + i * 28,
          `Round ${d.round}:`,
          {
            fontFamily: FONTS.pixel,
            fontSize: FONTS.size.sm,
            color: COLORS.textSecondary,
          },
        )
        .setDepth(10);

      this.add
        .text(
          380,
          startY + i * 28,
          text,
          {
            fontFamily: FONTS.pixel,
            fontSize: FONTS.size.sm,
            color: COLORS.textPrimary,
          },
        )
        .setDepth(10);
    });

    if (this.store.summary) {
      this.add
        .text(
          GAME_WIDTH / 2,
          panelY + 230,
          this.store.summary,
          {
            fontFamily: FONTS.pixel,
            fontSize: FONTS.size.sm,
            color: COLORS.textWarning,
            wordWrap: { width: 560 },
            align: 'center',
            lineSpacing: 6,
          },
        )
        .setOrigin(0.5, 0)
        .setDepth(10);
    }

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 80,
        '📄 Decision document saved to project',
        {
          fontFamily: FONTS.pixel,
          fontSize: FONTS.size.sm,
          color: COLORS.textSecondary,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 50,
        'Press SPACE to return to Common Room',
        {
          fontFamily: FONTS.pixel,
          fontSize: FONTS.size.sm,
          color: COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);

    this.input.keyboard!.on(
      'keydown-SPACE',
      () => {
        this.scene.start(
          'CommonRoomScene',
        );
      },
    );
  }
}