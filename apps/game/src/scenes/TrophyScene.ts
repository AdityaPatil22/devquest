import Phaser from 'phaser';

import {
  GAME_WIDTH,
  GAME_HEIGHT,
} from '../config';

import {
  PATTERNS_KEY,
  PATTERNS,
  TILE_SCALE,
  DISPLAY_TILE,
} from '../tiles';

export class TrophyScene extends Phaser.Scene {
  constructor() {
    super({
      key: 'TrophyScene',
    });
  }

  create(): void {
    this.buildRoom();
  }

  private buildRoom(): void {
    const cols =
      Math.floor(
        GAME_WIDTH /
          DISPLAY_TILE,
      );

    const rows =
      Math.floor(
        GAME_HEIGHT /
          DISPLAY_TILE,
      );

    for (
      let y = 1;
      y < rows - 1;
      y++
    ) {
      for (
        let x = 1;
        x < cols - 1;
        x++
      ) {
        const frame =
          (x + y) % 2 === 0
            ? PATTERNS.TROPHY_FLOOR
            : PATTERNS.TROPHY_FLOOR_ALT;

        this.add
          .image(
            x * DISPLAY_TILE +
              DISPLAY_TILE / 2,
            y * DISPLAY_TILE +
              DISPLAY_TILE / 2,
            PATTERNS_KEY,
            frame,
          )
          .setScale(TILE_SCALE)
          .setDepth(0);
      }
    }

    for (
      let x = 0;
      x < cols;
      x++
    ) {
      const frame =
        x % 2 === 0
          ? PATTERNS.TROPHY_WALL
          : PATTERNS.TROPHY_WALL_ALT;

      this.add
        .image(
          x * DISPLAY_TILE +
            DISPLAY_TILE / 2,
          DISPLAY_TILE / 2,
          PATTERNS_KEY,
          frame,
        )
        .setScale(TILE_SCALE)
        .setDepth(1);

      this.add
        .image(
          x * DISPLAY_TILE +
            DISPLAY_TILE / 2,
          (rows - 1) *
              DISPLAY_TILE +
            DISPLAY_TILE / 2,
          PATTERNS_KEY,
          frame,
        )
        .setScale(TILE_SCALE)
        .setDepth(1);
    }

    for (
      let y = 1;
      y < rows - 1;
      y++
    ) {
      const frame =
        y % 2 === 0
          ? PATTERNS.TROPHY_WALL
          : PATTERNS.TROPHY_WALL_ALT;

      this.add
        .image(
          DISPLAY_TILE / 2,
          y * DISPLAY_TILE +
            DISPLAY_TILE / 2,
          PATTERNS_KEY,
          frame,
        )
        .setScale(TILE_SCALE)
        .setDepth(1);

      this.add
        .image(
          (cols - 1) *
              DISPLAY_TILE +
            DISPLAY_TILE / 2,
          y * DISPLAY_TILE +
            DISPLAY_TILE / 2,
          PATTERNS_KEY,
          frame,
        )
        .setScale(TILE_SCALE)
        .setDepth(1);
    }

    for (
      let i = 3;
      i < cols - 3;
      i += 4
    ) {
      this.add
        .image(
          i * DISPLAY_TILE,
          DISPLAY_TILE / 2,
          PATTERNS_KEY,
          PATTERNS.DOOR_ALT,
        )
        .setScale(TILE_SCALE)
        .setDepth(3);
    }
  }
}