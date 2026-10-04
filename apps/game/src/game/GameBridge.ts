import Phaser from 'phaser';

import type { DecisionOption, Recommendation } from '../net/protocol';

export interface DecisionHistoryEntry {
  nodeId: string;
  round: number;
  question: string;
  selectedOption: DecisionOption;
  explanation?: string;
  recommendedOption?: string;
}

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
      type: 'START_SCREEN_READY';
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
      type: 'PROBLEM_SUBMITTING';
      message: string;
    }
  | {
      type: 'DECISION_ROOM_READY';
    }
  | {
      type: 'DECISION';
      nodeId: string;
      question: string;
      description: string;
      options: DecisionOption[];
      recommendation?: Recommendation;
      round: number;
    }
  | {
      type: 'DECISION_HISTORY';
      entry: DecisionHistoryEntry;
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
      type: 'AI_THINKING';
      visible: boolean;
      message?: string;
    }
  | {
      type: 'PLAYER_MOVING';
      visible: boolean;
    }
  | {
      type: 'OBJECTIVE';
      objective: string;
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
      type: 'TROPHY_PROXIMITY';
      visible: boolean;
    }
  | {
      type: 'TROPHY_INTERACTED';
      problem?: string;
      summary?: string;
      docContent?: string;
    }
  | {
      type: 'ERROR';
      message: string;
    };

export function emitUIEvent(
  game: Phaser.Game,
  event: GameUIEvent,
): void {
  game.events.emit('devquest:ui', event);
}