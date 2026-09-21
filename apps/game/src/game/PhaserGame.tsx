import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

import { createPhaserGame } from './createPhaserGame';
import { useGameUI } from '../state/GameUIContext';

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  const { setGame } = useGameUI();

  useEffect(() => {
    if (!containerRef.current || gameRef.current) {
      return;
    }

    const game = createPhaserGame(containerRef.current);

    gameRef.current = game;
    setGame(game);

    return () => {
      setGame(null);

      if (gameRef.current === game) {
        gameRef.current = null;
      }

      game.destroy(true);
    };
  }, [setGame]);

  return <div ref={containerRef} className="phaser-layer" />;
}
