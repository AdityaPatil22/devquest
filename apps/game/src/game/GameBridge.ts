import Phaser from 'phaser';

import type { DecisionOption, Recommendation } from '../net/protocol';

export type GameUIEvent =
  | {
      type: 'GAME_LOADING';
      loading: boolean;
      progress: number;
    }
  | {
      type: 'GAME_READY';
    }
  | {
      type: 'COMMON_ROOM_READY';
    }
  | {
      type: 'DECISION_ROOM_READY';
    }
  | {
      type: 'ELEVATOR_PROXIMITY';
      visible: boolean;
    }
  | {
      type: 'ELEVATOR_OPEN';
      waiting: boolean;
      message?: string;
    }
  | {
      type: 'ELEVATOR_SUBMITTING';
      message?: string;
    }
  | {
      type: 'ELEVATOR_CLOSED';
    }
  | {
      type: 'SESSION_STARTED';
      sessionId: string;
    }
  | {
      type: 'SESSION_RESUMED';
      sessionId?: string;
    }
  | {
      type: 'DECISION';
      nodeId: string;
      question: string;
      options: DecisionOption[];
      recommendation?: Recommendation;
      round: number;
    }
  | {
      type: 'EXPLORING_DOORS';
    }
  | {
      type: 'DOOR_PROXIMITY';
      visible: boolean;
      option?: DecisionOption;
    }
  | {
      type: 'DOOR_CONTEXT';
      visible: boolean;
      option?: DecisionOption;
    }
  | {
      type: 'WAITING';
      message: string;
    }
  | {
      type: 'CHALLENGE';
      question: string;
    }
  | {
      type: 'EVALUATION';
      feedback: string;
      consequence: string;
    }
  | {
      type: 'NEXT_DECISION_LOADING';
    }
  | {
      type: 'SESSION_COMPLETE';
      summary: string;
      docContent: string;
    }
  | {
      type: 'ERROR';
      message: string;
    };

export function emitUIEvent(game: Phaser.Game, event: GameUIEvent): void {
  game.events.emit('devquest:ui', event);
}
