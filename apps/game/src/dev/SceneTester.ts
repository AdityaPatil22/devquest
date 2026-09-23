import type Phaser from 'phaser';

import { createDevGameState } from './DevGameFactory';
import { DevWebSocketClient } from './DevWebSocketClient';
import { SessionStore } from '../state/SessionStore';

export type DevScene =
  | 'FullFlow'
  | 'CommonRoomScene'
  | 'GrillingScene'
  | 'TrophyScene';

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

export function launchScene(
  game: Phaser.Game,
  scene: DevScene,
): void {
  // Stop all active scenes before launching.
  game.scene.getScenes(true).forEach((s) => {
    game.scene.stop(s.scene.key);
  });

  switch (scene) {
    // -----------------------------------------------------------------------
    // Full flow: CommonRoom → GrillingScene (3 rounds) → TrophyScene
    //
    // The player interacts normally. DevWebSocketClient handles all server
    // responses automatically (DECISION_CREATED, CHALLENGE, EVALUATION,
    // SESSION_COMPLETE) so no real backend is needed.
    // -----------------------------------------------------------------------
    case 'FullFlow': {
      const ws = new DevWebSocketClient();
      const store = new SessionStore();

      game.scene.start('CommonRoomScene', {
        ws,
        store,
        gateWaiting: false,
      });

      break;
    }

    // -----------------------------------------------------------------------
    // Common Room only (no problem pre-loaded).
    // Useful for testing the elevator / problem-submission UI in isolation.
    // -----------------------------------------------------------------------
    case 'CommonRoomScene': {
      const { ws, store } = createDevGameState();

      game.scene.start('CommonRoomScene', {
        ws,
        store,
        gateWaiting: false,
      });

      break;
    }

    // -----------------------------------------------------------------------
    // GrillingScene starting at round 1.
    // Skips CommonRoom; player sees the first decision immediately.
    // DevWebSocketClient fires CHALLENGE → EVALUATION → DECISION_CREATED
    // for 3 rounds automatically.
    // -----------------------------------------------------------------------
    case 'GrillingScene': {
      const { ws, store, decision } = createDevGameState();

      game.scene.start('GrillingScene', {
        ws,
        store,
        decision,
        restored: false,
        devMode: true,
      });

      break;
    }

    // -----------------------------------------------------------------------
    // Trophy Room with a completed session.
    // -----------------------------------------------------------------------
    case 'TrophyScene': {
      const { store } = createDevGameState();

      store.setProblem('How should we implement this feature?');

      store.updateCurrent({
        selectedOptionId: 'option-c',
        context: 'Use existing components where possible.',
        defense: 'A hybrid solution reduces implementation risk.',
        feedback:
          'The proposed approach balances reuse and flexibility well.',
        consequence:
          'The implementation will be easier to maintain long-term.',
      });

      store.complete(
        'You made three strong architectural decisions. The system is well-positioned for growth.',
        '# DevQuest Decision Document\n\nA hybrid implementation was selected based on careful analysis of trade-offs.',
      );

      game.scene.start('TrophyScene', {
        store,
      });

      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Restart current scene
// ---------------------------------------------------------------------------

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
      feedback: 'The proposed approach balances reuse and flexibility well.',
      consequence: 'The implementation will be easier to maintain long-term.',
    });

    store.complete(
      'You made three strong architectural decisions. The system is well-positioned for growth.',
      '# DevQuest Decision Document\n\nA hybrid implementation was selected.',
    );

    currentScene.scene.restart({
      store,
    });

    return;
  }

  currentScene.scene.restart();
}
