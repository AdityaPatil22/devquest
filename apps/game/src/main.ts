import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CommonRoomScene } from './scenes/CommonRoomScene';
import { GateScene } from './scenes/GateScene';
import { DecisionRoomScene } from './scenes/DecisionRoomScene';
import { TrophyScene } from './scenes/TrophyScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
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
    // Canvas always exactly matches the window/container size (no
    // letterboxing black bars like FIT produces on non-4:3 screens).
    mode: Phaser.Scale.RESIZE,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
};

const game = new Phaser.Game(config);

// Keep the canvas filling the viewport if the browser window is resized.
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
