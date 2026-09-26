import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

import { createPhaserGame } from './createPhaserGame';
import { useGameUI } from '../state/GameUIContext';

declare global {
  var __DEVQUEST_PHASER_GAME__: Phaser.Game | undefined;
}

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setGame } = useGameUI();

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let game = globalThis.__DEVQUEST_PHASER_GAME__;

    if (!game) {
      game = createPhaserGame(container);

      if (import.meta.env.DEV) {
        globalThis.__DEVQUEST_PHASER_GAME__ = game;
      }
    }

    if (game.canvas.parentElement !== container) {
      container.appendChild(game.canvas);
      game.scale.refresh();
    }

    setGame(game);

    return () => {
      if (import.meta.env.DEV) {
        return;
      }

      game?.destroy(true);

      if (globalThis.__DEVQUEST_PHASER_GAME__ === game) {
        globalThis.__DEVQUEST_PHASER_GAME__ = undefined;
      }

      setGame(null);
    };
  }, [setGame]);

  return <div ref={containerRef} className="phaser-layer" />;
}