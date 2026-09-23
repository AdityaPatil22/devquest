import Phaser from 'phaser';

import {
  OPTION_ROOM_TILEMAP_KEYS,
  OPTION_ROOM_TILE_LAYERS,
  OPTION_ROOM_COLLIDABLE_LAYER,
  OPTION_ROOM_WIDTH_PX,
  OPTION_ROOM_HEIGHT_PX,
  patchOptionRoomTilesets,
  OPTION_ROOM_TILESETS,
} from '../tilemaps/optionRoomTilemap';

export interface OptionRoomConfig {
  /** Horizontal center of the room in world space. */
  x: number;
  /** Top edge of the room in world space. */
  y: number;
  /** Player sprite for collision wiring. */
  player: Phaser.Physics.Arcade.Sprite;
}

export class OptionRoomGenerator {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Place a randomly chosen option-room tilemap at
   * the given world position, wire up wall collision,
   * and return the room height in pixels so the caller
   * can advance its `worldBottomY` cursor.
   */
  create(config: OptionRoomConfig): number {
    const { x, y, player } = config;

    // Pick a random room template.
    const key =
      OPTION_ROOM_TILEMAP_KEYS[
        Math.floor(Math.random() * OPTION_ROOM_TILEMAP_KEYS.length)
      ];

    // Patch external tileset references before Phaser reads them.
    const cached = this.scene.cache.tilemap.get(key);

    if (cached?.data) {
      patchOptionRoomTilesets(cached.data);
    }

    const map = this.scene.make.tilemap({ key });

    const tilesets = OPTION_ROOM_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);

    // Top-left corner of the room, centered horizontally on `x`.
    const offsetX = x - OPTION_ROOM_WIDTH_PX / 2;
    const offsetY = y;

    OPTION_ROOM_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = map.createLayer(
        layerName,
        tilesets,
        offsetX,
        offsetY,
      );

      layer?.setDepth(depth);

      if (layerName === OPTION_ROOM_COLLIDABLE_LAYER) {
        layer?.setCollisionByExclusion([-1]);

        if (layer) {
          this.scene.physics.add.collider(player, layer);
        }
      }
    });

    return OPTION_ROOM_HEIGHT_PX;
  }
}
