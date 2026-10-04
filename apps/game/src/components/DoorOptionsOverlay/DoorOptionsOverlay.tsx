import { useEffect, useState } from 'react';

import type Phaser from 'phaser';

import './DoorOptionsOverlay.css';

interface DoorOptionAnchor {
  key: 'A' | 'B' | 'C' | 'D';
  label: string;
  x: number;
  y: number;
  active: boolean;
}

interface ScreenAnchor extends DoorOptionAnchor {
  screenX: number;
  screenY: number;
}

interface Props {
  game: Phaser.Game | null;
  visible: boolean;
}

function getScreenAnchors(game: Phaser.Game): ScreenAnchor[] {
  const scene = game.scene.getScene('GrillingScene') as
    | (Phaser.Scene & {
        getDoorOptionAnchors?: () => DoorOptionAnchor[];
      })
    | undefined;

  if (!scene?.getDoorOptionAnchors) {
    return [];
  }

  const canvas = game.canvas;

  if (!canvas) {
    return [];
  }

  const rect = canvas.getBoundingClientRect();

  const camera = scene.cameras.main;

  if (rect.width <= 0 || rect.height <= 0 || camera.width <= 0 || camera.height <= 0) {
    return [];
  }

  const scaleX = rect.width / camera.width;

  const scaleY = rect.height / camera.height;

  const anchors = scene.getDoorOptionAnchors();

  return anchors.map((anchor) => ({
    ...anchor,

    screenX: rect.left + (anchor.x - camera.worldView.x) * scaleX,

    screenY: rect.top + (anchor.y - camera.worldView.y) * scaleY,
  }));
}

export function DoorOptionsOverlay({ game, visible }: Props) {
  const [anchors, setAnchors] = useState<ScreenAnchor[]>([]);

  useEffect(() => {
    if (!game || !visible) {
      setAnchors([]);

      return;
    }

    let animationFrame = 0;

    let lastFrame = '';

    const update = () => {
      const next = getScreenAnchors(game);

      const signature = next
        .map((anchor) =>
          [anchor.key, Math.round(anchor.screenX), Math.round(anchor.screenY), anchor.active].join(
            ':',
          ),
        )
        .join('|');

      if (signature !== lastFrame) {
        lastFrame = signature;

        setAnchors(next);
      }

      animationFrame = window.requestAnimationFrame(update);
    };

    update();

    const handleResize = () => {
      lastFrame = '';
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(animationFrame);

      window.removeEventListener('resize', handleResize);
    };
  }, [game, visible]);

  if (!visible || anchors.length === 0) {
    return null;
  }

  return (
    <div className="door-options-overlay" aria-hidden="true">
      {anchors.map((anchor) => (
        <div
          className={['door-option-overlay', anchor.active ? 'door-option-overlay--active' : '']
            .filter(Boolean)
            .join(' ')}
          key={anchor.key}
          style={{
            left: `${anchor.screenX}px`,
            top: `${anchor.screenY}px`,
          }}
        >
          <div className="door-option-overlay__label">
            <span className="door-option-overlay__key">{anchor.key}</span>

            <span className="door-option-overlay__text">{anchor.label}</span>
          </div>

          <div className="door-option-overlay__connector" />
        </div>
      ))}
    </div>
  );
}
