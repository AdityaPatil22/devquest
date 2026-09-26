import type Phaser from 'phaser';

import {
  createDevGameSession,
  type DevGameSession,
} from './DevGameFactory';

interface DevRuntime {
  session?: DevGameSession;
}

declare global {
  var __DEVQUEST_RUNTIME__: DevRuntime | undefined;
}

function getRuntime(): DevRuntime {
  if (!globalThis.__DEVQUEST_RUNTIME__) {
    globalThis.__DEVQUEST_RUNTIME__ = {};
  }

  return globalThis.__DEVQUEST_RUNTIME__;
}

export function getDevGameSession(): DevGameSession {
  const runtime = getRuntime();

  if (!runtime.session) {
    runtime.session = createDevGameSession();
  }

  return runtime.session;
}

export function resetDevGameSession(): DevGameSession {
  const runtime = getRuntime();

  runtime.session?.ws.disconnect();

  runtime.session = createDevGameSession();

  return runtime.session;
}

function stopGameplayScenes(game: Phaser.Game): void {
  [
    'BootScene',
    'CommonRoomScene',
    'GrillingScene',
    'TrophyScene',
  ].forEach((key) => {
    const scene = game.scene.getScene(key);

    if (scene?.scene.isActive()) {
      scene.scene.stop();
    }
  });
}

export function resetDevGame(game: Phaser.Game): void {
  const { ws, store } = resetDevGameSession();

  stopGameplayScenes(game);

  game.scene.start('CommonRoomScene', {
    ws,
    store,
    gateWaiting: false,
  });
}

export function launchDevScene(
  game: Phaser.Game,
  scene: 'CommonRoomScene' | 'GrillingScene' | 'TrophyScene',
): void {
  const { ws, store } = resetDevGameSession();

  stopGameplayScenes(game);

  switch (scene) {
    case 'CommonRoomScene':
      game.scene.start('CommonRoomScene', {
        ws,
        store,
        gateWaiting: false,
      });
      break;

    case 'GrillingScene': {
      const decision = {
        type: 'DECISION_CREATED' as const,
        nodeId: 'dev-scene-test',
        question: 'Which implementation approach should we choose?',
        options: [
          {
            id: 'option-a',
            label: 'Option A',
          },
          {
            id: 'option-b',
            label: 'Option B',
          },
          {
            id: 'option-c',
            label: 'Option C',
          },
          {
            id: 'option-d',
            label: 'Option D',
          },
        ],
        recommendation: {
          option: 'option-b',
          why: 'This is the mock recommendation for scene testing.',
        },
        round: 1,
      };

      store.addDecision({
        nodeId: decision.nodeId,
        question: decision.question,
        options: decision.options,
        recommendation: decision.recommendation,
        round: decision.round,
      });

      store.setProblem(
        'How should we implement this feature?',
      );

      game.scene.start('GrillingScene', {
        ws,
        store,
        decision,
        restored: false,
      });

      break;
    }

    case 'TrophyScene':
      store.setProblem(
        'How should we implement this feature?',
      );

      store.complete(
        'This is a mock completed DevQuest session.',
        `# DevQuest Session

## Decision
Option B

## Summary
Mock trophy-room data for UI testing.
`,
      );

      game.scene.start('TrophyScene', {
        store,
      });

      break;
  }
}