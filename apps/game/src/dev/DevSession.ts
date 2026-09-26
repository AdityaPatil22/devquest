import type Phaser from 'phaser';

import { createDevGameSession, type DevGameSession } from './DevGameFactory';

let session: DevGameSession | undefined;

export function getDevGameSession(): DevGameSession {
  if (!session) {
    session = createDevGameSession();
  }

  return session;
}


export function resetDevGameSession(): DevGameSession {
  session = createDevGameSession();

  return session;
}

export function launchDevGame(game: Phaser.Game): void {
  const { ws, store } = getDevGameSession();

  const boot = game.scene.getScene('BootScene');

  if (!boot.scene.isActive()) {
    game.scene.start('CommonRoomScene', {
      ws,
      store,
      gateWaiting: false,
    });
  }
}