import { useState } from 'react';
import type Phaser from 'phaser';
import { launchScene, restartScene, type DevScene } from './SceneTester';

interface DevToolbarProps {
  game: Phaser.Game | null;
}

const scenes: { label: string; value: DevScene }[] = [
  {
    label: 'Common Room',
    value: 'CommonRoomScene',
  },
  {
    label: 'Decision Room',
    value: 'DecisionRoomScene',
  },
  {
    label: 'Trophy Room',
    value: 'TrophyScene',
  },
];

export function DevToolbar({ game }: DevToolbarProps) {
  const [selectedScene, setSelectedScene] = useState<DevScene>('TrophyScene');
  if (!import.meta.env.DEV) {
    return null;
  }
  return (
    <div className="dev-toolbar">
      <span className="dev-toolbar__title">DEV MODE</span>
      <select
        value={selectedScene}
        onChange={(event) => {
          setSelectedScene(event.target.value as DevScene);
        }}
      >
        {scenes.map((scene) => (
          <option key={scene.value} value={scene.value}>
            {scene.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!game}
        onClick={() => {
          if (game) {
            launchScene(game, selectedScene);
          }
        }}
      >
        Launch
      </button>
      <button
        type="button"
        disabled={!game}
        onClick={() => {
          if (game) {
            restartScene(game);
          }
        }}
      >
        Restart
      </button>
    </div>
  );
}
