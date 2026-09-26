import type Phaser from 'phaser';

import { useGameUI } from '../state/GameUIContext';
import {
  launchDevScene,
  resetDevGame,
} from './DevSession';

interface DevToolbarProps {
  game: Phaser.Game | null;
}

type DevScene =
  | 'CommonRoomScene'
  | 'GrillingScene'
  | 'TrophyScene';

const scenes: {
  label: string;
  value: DevScene;
}[] = [
  {
    label: 'Common Room',
    value: 'CommonRoomScene',
  },
  {
    label: 'Decision Room',
    value: 'GrillingScene',
  },
  {
    label: 'Trophy Room',
    value: 'TrophyScene',
  },
];

export function DevToolbar({ game }: DevToolbarProps) {
  const { state } = useGameUI();

  const disabled = !game || state.loading;

  return (
    <div className="dev-toolbar">
      <span className="dev-toolbar__title">
        DEV MODE
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
        Full Flow
      </button>

      {scenes.map((scene) => (
        <button
          key={scene.value}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (game) {
              launchDevScene(game, scene.value);
            }
          }}
        >
          {scene.label}
        </button>
      ))}

      <button
        type="button"
        disabled={!game}
        onClick={() => {
          if (game) {
            resetDevGame(game);
          }
        }}
      >
        Reset
      </button>
    </div>
  );
}