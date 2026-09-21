import type Phaser from 'phaser';
import { createDevGameState } from './DevGameFactory';
export type DevScene = 'CommonRoomScene' | 'DecisionRoomScene' | 'TrophyScene';

export function launchScene(game: Phaser.Game, scene: DevScene): void {
  const activeScenes = game.scene.getScenes(true);
  activeScenes.forEach((activeScene) => {
    game.scene.stop(activeScene.scene.key);
  });
  switch (scene) {
    case 'TrophyScene': {
      game.scene.start('TrophyScene');
      break;
    }
    case 'CommonRoomScene': {
      const { ws, store } = createDevGameState();
      game.scene.start('CommonRoomScene', {
        ws,
        store,
        gateWaiting: false,
      });
      break;
    }
    case 'DecisionRoomScene': {
      const { ws, store, decision } = createDevGameState();
      game.scene.start('DecisionRoomScene', {
        ws,
        store,
        decision,
        restored: false,
      });
      break;
    }
  }
}

export function restartScene(game: Phaser.Game): void {
  const activeScenes = game.scene.getScenes(true);
  if (activeScenes.length === 0) {
    return;
  }

  const currentScene = activeScenes[0];
  currentScene.scene.restart();
}
