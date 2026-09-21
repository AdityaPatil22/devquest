import {
  useEffect,
  useRef,
} from 'react';

import { createPhaserGame } from './createPhaserGame';
import { useGameUI } from '../state/GameUIContext';

export function PhaserGame() {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const { setGame } =
    useGameUI();

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const game =
      createPhaserGame(
        containerRef.current,
      );

    setGame(game);

    return () => {
      setGame(null);

      game.destroy(true);
    };
  }, [setGame]);

  return (
    <div
      ref={containerRef}
      className="phaser-layer"
    />
  );
}