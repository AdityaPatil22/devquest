import Phaser from 'phaser';

export type GameUIEvent =
  | {
      type: 'ELEVATOR_NEAR';
      visible: boolean;
    }
  | {
      type: 'OPEN_ELEVATOR';
    }
  | {
      type: 'DOOR_SELECTED';
      optionId: string;
    };

export function emitUIEvent(
  game: Phaser.Game,
  event: GameUIEvent,
) {
  game.events.emit(
    'devquest:ui',
    event,
  );
}