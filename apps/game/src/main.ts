import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CommonRoomScene } from './scenes/CommonRoomScene';
import { GateScene } from './scenes/GateScene';
import { DecisionRoomScene } from './scenes/DecisionRoomScene';
import { TrophyScene } from './scenes/TrophyScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  pixelArt: true,
  backgroundColor: '#0a0a1a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, CommonRoomScene, GateScene, DecisionRoomScene, TrophyScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
