import { useState } from 'react';
import type Phaser from 'phaser';
import { launchScene, restartScene, type DevScene } from './SceneTester';

interface DevToolbarProps {
  game: Phaser.Game | null;
}

const scenes: { label: string; value: DevScene; description: string }[] = [
  {
    label: 'Full Flow',
    value: 'FullFlow',
    description: 'CommonRoom → elevator → 3 grilling rounds → Trophy',
  },
  {
    label: 'Grilling Scene',
    value: 'GrillingScene',
    description: 'Jump straight to round 1; auto-advances through 3 rounds',
  },
  {
    label: 'Common Room',
    value: 'CommonRoomScene',
    description: 'CommonRoom only — elevator UI + problem submission',
  },
  {
    label: 'Trophy Room',
    value: 'TrophyScene',
    description: 'Session complete screen with mock data',
  },
];

export function DevToolbar({ game }: DevToolbarProps) {
  const [selectedScene, setSelectedScene] =
    useState<DevScene>('FullFlow');

  const selected = scenes.find((s) => s.value === selectedScene);

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

      {selected && (
        <span className="dev-toolbar__desc">
          {selected.description}
        </span>
      )}

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
