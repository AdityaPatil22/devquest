import type Phaser from 'phaser';

import { createDevGameState } from './DevGameFactory';

export type DevScene =
  | 'CommonRoomScene'
  | 'DecisionRoomScene'
  | 'TrophyScene';

export function launchScene(game: Phaser.Game, scene: DevScene): void {
  const activeScenes = game.scene.getScenes(true);

  activeScenes.forEach((activeScene) => {
    game.scene.stop(activeScene.scene.key);
  });

  switch (scene) {
    case 'TrophyScene': {
      const { store } = createDevGameState();

      store.setProblem('How should we implement this feature?');

      store.updateCurrent({
        selectedOptionId: 'option-c',
        context: 'Use existing components where possible.',
        defense: 'A hybrid solution reduces implementation risk.',
        feedback: 'The proposed approach balances reuse and flexibility.',
        consequence: 'The implementation remains easier to maintain.',
      });

      store.complete(
        'The session explored several approaches and selected a hybrid solution.',
        '# DevQuest Decision Document\n\nA hybrid implementation was selected.',
      );

      game.scene.start('TrophyScene', {
        store,
      });

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

  if (currentScene.scene.key === 'TrophyScene') {
    const { store } = createDevGameState();

    store.setProblem('How should we implement this feature?');

    store.updateCurrent({
      selectedOptionId: 'option-c',
      context: 'Use existing components where possible.',
      defense: 'A hybrid solution reduces implementation risk.',
      feedback: 'The proposed approach balances reuse and flexibility.',
      consequence: 'The implementation remains easier to maintain.',
    });

    store.complete(
      'The session explored several approaches and selected a hybrid solution.',
      '# DevQuest Decision Document\n\nA hybrid implementation was selected.',
    );

    currentScene.scene.restart({
      store,
    });

    return;
  }

  currentScene.scene.restart();
}