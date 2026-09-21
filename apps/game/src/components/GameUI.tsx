import { useCallback, useEffect } from 'react';

import type { DecisionOption } from '../net/protocol';
import { useGameUI } from '../state/GameUIContext';

import { HUD } from './HUD/HUD';
import { InteractionPrompt } from './InteractionPrompt/InteractionPrompt';
import { ElevatorModal } from './ElevatorModal/ElevatorModal';
import { DoorContextModal } from './DecisionPanel/DoorContextModal';
import { ChallengePanel } from './ChallengePanel/ChallengePanel';
import { EvaluationPanel } from './EvaluationPanel/EvaluationPanel';
import { WaitingOverlay } from './WaitingOverlay/WaitingOverlay';

interface GameUIEvent {
  type: string;
  [key: string]: unknown;
}

export function GameUI() {
  const { game, state, setState } = useGameUI();

  useEffect(() => {
    if (!game) {
      return;
    }

    const handler = (event: GameUIEvent) => {
      switch (event.type) {
        case 'GAME_LOADING':
          setState((previous) => ({
            ...previous,
            loading: Boolean(event.loading),
            loadingProgress: Number(event.progress ?? 0),
          }));
          break;

        case 'GAME_READY':
          setState((previous) => ({
            ...previous,
            gameReady: true,
            loading: false,
          }));
          break;

        case 'COMMON_ROOM_READY':
          setState((previous) => ({
            ...previous,
            screen: 'common',
            loading: false,
          }));
          break;

        case 'DECISION_ROOM_READY':
          setState((previous) => ({
            ...previous,
            screen: 'decision',
            loading: false,
          }));
          break;

        case 'ELEVATOR_PROXIMITY':
          setState((previous) => ({
            ...previous,
            elevatorNear: Boolean(event.visible),
          }));
          break;

        case 'ELEVATOR_OPEN':
          setState((previous) => ({
            ...previous,
            screen: 'common',
            modal: 'elevator',
            elevatorWaiting: Boolean(event.waiting),
            waitingMessage: typeof event.message === 'string' ? event.message : undefined,
            error: undefined,
          }));
          break;

        case 'ELEVATOR_SUBMITTING':
          setState((previous) => ({
            ...previous,
            modal: 'elevator',
            elevatorWaiting: true,
            waitingMessage:
              typeof event.message === 'string' ? event.message : 'Entering the elevator...',
            error: undefined,
          }));
          break;

        case 'ELEVATOR_CLOSED':
          setState((previous) => ({
            ...previous,
            modal: null,
            elevatorNear: false,
            elevatorWaiting: false,
          }));
          break;

        case 'SESSION_STARTED':
          setState((previous) => ({
            ...previous,
            screen: 'common',
            loading: false,
            error: undefined,
          }));
          break;

        case 'SESSION_RESUMED':
          setState((previous) => ({
            ...previous,
            loading: false,
            error: undefined,
          }));
          break;

        case 'DECISION':
          setState((previous) => ({
            ...previous,
            screen: 'decision',
            modal: null,
            question: typeof event.question === 'string' ? event.question : undefined,
            options: Array.isArray(event.options) ? (event.options as DecisionOption[]) : [],
            recommendation: event.recommendation as typeof previous.recommendation | undefined,
            round: typeof event.round === 'number' ? event.round : undefined,
            selectedOption: undefined,
            challenge: undefined,
            feedback: undefined,
            consequence: undefined,
            waitingMessage: undefined,
            error: undefined,
          }));
          break;

        case 'EXPLORING_DOORS':
          setState((previous) => ({
            ...previous,
            screen: 'decision',
            modal: null,
            waitingMessage: undefined,
            error: undefined,
          }));
          break;

        case 'DOOR_PROXIMITY':
          setState((previous) => ({
            ...previous,
            doorNear: Boolean(event.visible),
            nearDoorOption: event.option as DecisionOption | undefined,
            elevatorNear: false,
          }));
          break;

        case 'DOOR_CONTEXT':
          setState((previous) => ({
            ...previous,
            modal: event.visible === false ? null : 'door-context',
            selectedOption: event.option as DecisionOption | undefined,
          }));
          break;

        case 'WAITING':
          setState((previous) => ({
            ...previous,
            modal: 'waiting',
            waitingMessage: typeof event.message === 'string' ? event.message : 'Waiting...',
          }));
          break;

        case 'CHALLENGE':
          setState((previous) => ({
            ...previous,
            modal: 'challenge',
            challenge: typeof event.question === 'string' ? event.question : undefined,
            waitingMessage: undefined,
            error: undefined,
          }));
          break;

        case 'EVALUATION':
          setState((previous) => ({
            ...previous,
            modal: 'evaluation',
            feedback: typeof event.feedback === 'string' ? event.feedback : undefined,
            consequence: typeof event.consequence === 'string' ? event.consequence : undefined,
            waitingMessage: undefined,
          }));
          break;

        case 'NEXT_DECISION_LOADING':
          setState((previous) => ({
            ...previous,
            modal: 'waiting',
            waitingMessage: 'Preparing the next decision...',
          }));
          break;

        case 'SESSION_COMPLETE':
          setState((previous) => ({
            ...previous,
            screen: 'complete',
            modal: null,
            summary: typeof event.summary === 'string' ? event.summary : undefined,
            docContent: typeof event.docContent === 'string' ? event.docContent : undefined,
            waitingMessage: undefined,
            error: undefined,
          }));
          break;

        case 'ERROR':
          setState((previous) => ({
            ...previous,
            error: typeof event.message === 'string' ? event.message : 'Something went wrong.',
            elevatorWaiting: false,
          }));
          break;
      }
    };

    game.events.on('devquest:ui', handler);

    return () => {
      game.events.off('devquest:ui', handler);
    };
  }, [game, setState]);

  const submitProblem = useCallback(
    (problem: string) => {
      const scene = game?.scene.getScene('CommonRoomScene') as
        | {
            submitProblem?: (value: string) => void;
          }
        | undefined;

      scene?.submitProblem?.(problem);
    },
    [game],
  );

  const closeElevator = useCallback(() => {
    const scene = game?.scene.getScene('CommonRoomScene') as
      | {
          closeGate?: () => void;
        }
      | undefined;

    scene?.closeGate?.();
  }, [game]);

  const submitDoorContext = useCallback(
    (context?: string) => {
      const scene = game?.scene.getScene('DecisionRoomScene') as
        | {
            confirmDoorSelection?: (value?: string) => void;
          }
        | undefined;

      scene?.confirmDoorSelection?.(context);
    },
    [game],
  );

  const cancelDoorContext = useCallback(() => {
    const scene = game?.scene.getScene('DecisionRoomScene') as
      | {
          cancelDoorSelection?: () => void;
        }
      | undefined;

    scene?.cancelDoorSelection?.();
  }, [game]);

  const submitDefense = useCallback(
    (defense: string) => {
      const scene = game?.scene.getScene('DecisionRoomScene') as
        | {
            submitDefense?: (value: string) => void;
          }
        | undefined;

      scene?.submitDefense?.(defense);
    },
    [game],
  );

  return (
    <>
      <HUD />

      <InteractionPrompt
        visible={state.elevatorNear && state.modal === null}
        text="Press E to enter the elevator"
      />

      <InteractionPrompt
        visible={state.doorNear && state.modal === null}
        text={
          state.nearDoorOption
            ? `Press E to enter ${state.nearDoorOption.label}`
            : 'Press E to enter the door'
        }
      />

      <ElevatorModal
        open={state.modal === 'elevator'}
        waiting={state.elevatorWaiting}
        onSubmit={submitProblem}
        onClose={closeElevator}
        error={state.error}
      />

      <DoorContextModal
        open={state.modal === 'door-context'}
        option={state.selectedOption}
        onSubmit={submitDoorContext}
        onCancel={cancelDoorContext}
      />

      <ChallengePanel
        open={state.modal === 'challenge'}
        question={state.challenge}
        onSubmit={submitDefense}
      />

      <EvaluationPanel
        open={state.modal === 'evaluation'}
        feedback={state.feedback}
        consequence={state.consequence}
      />

      <WaitingOverlay open={state.modal === 'waiting'} message={state.waitingMessage} />

      {state.error && <div className="game-error">{state.error}</div>}
    </>
  );
}
