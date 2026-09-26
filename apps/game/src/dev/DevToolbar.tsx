import type Phaser from 'phaser';

import { useGameUI } from '../state/GameUIContext';
import { resetDevGame } from './DevSession';

interface DevToolbarProps {
  game: Phaser.Game | null;
}

export function DevToolbar({ game }: DevToolbarProps) {
  const { state } = useGameUI();

  const disabled = !game || state.loading;

  return (
    <div className="dev-toolbar">
      <span className="dev-toolbar__title">
        DEV MODE
      </span>

      <span className="dev-toolbar__desc">
        Common Room → Decision → Corridor → Options → Trophy
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (game) {
            resetDevGame(game);
          }
        }}
      >
        Reset Session
      </button>
    </div>
  );
}