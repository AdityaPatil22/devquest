import Phaser from 'phaser';

import { BootScene } from '../scenes/BootScene';
import { CommonRoomScene } from '../scenes/CommonRoomScene';
import { DecisionRoomScene } from '../scenes/DecisionRoomScene';
import { TrophyScene } from '../scenes/TrophyScene';

import {
  GAME_WIDTH,
  GAME_HEIGHT,
} from '../config';

export function createPhaserGame(
  parent: HTMLElement,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,

    parent,

    width: GAME_WIDTH,
    height: GAME_HEIGHT,

    pixelArt: true,

    backgroundColor: '#070712',

    physics: {
      default: 'arcade',

      arcade: {
        gravity: {
          x: 0,
          y: 0,
        },

        debug: false,
      },
    },

    scene: [
      BootScene,
      CommonRoomScene,
      DecisionRoomScene,
      TrophyScene,
    ],

    scale: {
      mode: Phaser.Scale.RESIZE,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
  });
}