/**
 * The two things every scene wires up the same way: the React UI bridge and
 * the movement/interact key bindings.
 */

import Phaser from 'phaser';

import { emitUIEvent, type GameUIEvent } from '../../game/GameBridge';

export function emitUI(scene: Phaser.Scene, event: GameUIEvent): void {
  emitUIEvent(scene.game, event);
}

export interface SceneKeys {
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  interact: Phaser.Input.Keyboard.Key;
}

/** Arrow keys for movement plus `E` to interact. */
export function createSceneKeys(scene: Phaser.Scene): SceneKeys {
  const keyboard = scene.input.keyboard!;

  return {
    cursors: keyboard.createCursorKeys(),
    interact: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
  };
}
