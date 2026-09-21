import Phaser from 'phaser';

import { BootScene } from '../scenes/BootScene';
import { CommonRoomScene } from '../scenes/CommonRoomScene';
import { DecisionRoomScene } from '../scenes/DecisionRoomScene';
import { TrophyScene } from '../scenes/TrophyScene';

export function createPhaserGame(
  parent: HTMLElement,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,

    parent,

    width: 1024,
    height: 768,

    pixelArt: true,

    backgroundColor: '#0a0a1a',

    physics: {
      default: 'arcade',

      arcade: {
        gravity: {
          x: 0,
          y: 0,
        },
      },
    },

    scene: [
      BootScene,
      CommonRoomScene,
      DecisionRoomScene,
      TrophyScene,
    ],
  });
}