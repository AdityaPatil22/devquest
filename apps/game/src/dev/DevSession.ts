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

export function resetDevGame(game: Phaser.Game): void {
  const { ws, store } = resetDevGameSession();

  const sceneKeys = [
    'CommonRoomScene',
    'GrillingScene',
    'TrophyScene',
  ];

  sceneKeys.forEach((key) => {
    const scene = game.scene.getScene(key);

    if (scene?.scene.isActive()) {
      scene.scene.stop();
    }
  });

  game.scene.start('CommonRoomScene', {
    ws,
    store,
    gateWaiting: false,
  });
}