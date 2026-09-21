import {
  useEffect,
  useRef,
} from 'react';

import Phaser from 'phaser';

import { createPhaserGame } from './createPhaserGame';

interface Props {
  onGameReady?: (
    game: Phaser.Game,
  ) => void;
}

export function PhaserGame({
  onGameReady,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const game =
      createPhaserGame(
        containerRef.current,
      );

    onGameReady?.(game);

    return () => {
      game.destroy(true);
    };
  }, [onGameReady]);

  return (
    <div
      ref={containerRef}
      className="phaser-layer"
    />
  );
}