import Phaser from 'phaser';

import { emitUI } from '../support/sceneUi';
import type { WorldSegment } from './segment';

export interface CorridorInteractable {
  id: number;
  type: 'ai-workstation' | 'ai-terminal';
  x: number;
  y: number;
  width: number;
  height: number;
}

const INTERACT_DISTANCE = 50;

export class CorridorInteractionManager {
  private current?: CorridorInteractable;

  constructor(
    private readonly scene: Phaser.Scene,
    private playerSprite: Phaser.Physics.Arcade.Sprite,
  ) {}

  setPlayer(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.playerSprite = sprite;
  }

  reset(): void {
    this.current = undefined;
    emitUI(this.scene, {
      type: 'WORKSTATION_PROXIMITY',
      visible: false,
    });
    emitUI(this.scene, {
      type: 'WORKSTATION_OPEN',
      visible: false,
    });
  }

  update(corridor: WorldSegment | undefined): CorridorInteractable | undefined {
    const objects = corridor?.objects ?? [];

    let nearest: CorridorInteractable | undefined;
    let nearestDistance = INTERACT_DISTANCE;

    for (const object of objects) {
      const data = object.getData('corridorInteractable') as CorridorInteractable | undefined;

      if (!data) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        this.playerSprite.x,
        this.playerSprite.y,
        data.x,
        data.y,
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = data;
      }
    }

    if (nearest === this.current) {
      return nearest;
    }

    this.current = nearest;

    if (nearest) {
      emitUI(this.scene, {
        type: 'WORKSTATION_PROXIMITY',
        visible: true,
        workstation: nearest.type,
      });
    } else {
      emitUI(this.scene, {
        type: 'WORKSTATION_PROXIMITY',
        visible: false,
      });
    }

    return nearest;
  }

  interact(): void {
    if (!this.current) {
      return;
    }

    emitUI(this.scene, {
      type: 'WORKSTATION_OPEN',
      visible: true,
      workstation: this.current.type,
    });
  }

  close(): void {
    emitUI(this.scene, {
      type: 'WORKSTATION_OPEN',
      visible: false,
      workstation: this.current?.type,
    });
  }

  get currentInteractable(): CorridorInteractable | undefined {
    return this.current;
  }
}