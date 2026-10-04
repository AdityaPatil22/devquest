import { useCallback, useEffect } from 'react';

import type { DecisionOption } from '../net/protocol';
import type { DecisionHistoryEntry } from '../game/GameBridge';
import { useGameUI } from '../state/GameUIContext';

import { HUD } from './HUD/HUD';
import { InteractionPrompt } from './InteractionPrompt/InteractionPrompt';
import { ProblemInput } from './ProblemInput/ProblemInput';
import { DoorContextModal } from './DecisionPanel/DoorContextModal';
import { DoorOptionsOverlay } from './DoorOptionsOverlay/DoorOptionsOverlay';
import { WaitingOverlay } from './WaitingOverlay/WaitingOverlay';
import { TrophySummary } from './TrophySummary/TrophySummary';
import { DecisionBriefPanel } from './DecisionBriefPanel/DecisionBriefPanel';

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

          case 'START_SCREEN_READY':
            setState((previous) => ({
              ...previous,
              screen: 'start',
              modal: 'problem-input',
              loading: false,
              objective: '',
              aiThinking: false,
              aiThinkingMessage: undefined,
              error: undefined,
            }));
            break;

        case 'DECISION_ROOM_READY':
          setState((previous) => ({
            ...previous,
            screen: 'decision',
            loading: false,
            objective: 'Choose a door',
          }));
          break;

        case 'ELEVATOR_PROXIMITY':
          setState((previous) => ({
            ...previous,
            elevatorNear: Boolean(event.visible),
            objective: event.visible ? 'Press E to enter the elevator' : previous.objective,
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
              screen: 'start',
              modal: 'problem-input',
              loading: false,
              decisionHistory: [],
              objective: '',
              aiThinking: false,
              aiThinkingMessage: undefined,
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

            description: typeof event.description === 'string' ? event.description : undefined,

            options: Array.isArray(event.options) ? (event.options as DecisionOption[]) : [],

            recommendation: event.recommendation as typeof previous.recommendation | undefined,

            round: typeof event.round === 'number' ? event.round : undefined,

            selectedOption: undefined,

            waitingMessage: undefined,

            aiThinking: false,

            aiThinkingMessage: undefined,

            objective: 'Choose a door',

            error: undefined,
          }));
          break;

        case 'DECISION_HISTORY': {
          const entry = event.entry as DecisionHistoryEntry;

          if (!entry || typeof entry !== 'object' || !entry.nodeId) {
            break;
          }

          setState((previous) => {
            const existingIndex = previous.decisionHistory.findIndex(
              (item) => item.nodeId === entry.nodeId,
            );

            if (existingIndex === -1) {
              return {
                ...previous,
                decisionHistory: [...previous.decisionHistory, entry],
              };
            }

            const decisionHistory = [...previous.decisionHistory];

            decisionHistory[existingIndex] = entry;

            return {
              ...previous,
              decisionHistory,
            };
          });

          break;
        }

        case 'PROBLEM_SUBMITTING':
          setState((previous) => ({
            ...previous,
            screen: 'start',
            modal: 'problem-input',
            waitingMessage:
              typeof event.message === 'string'
                ? event.message
                : 'Generating your first decision...',
            error: undefined,
          }));
          break;

        case 'EXPLORING_DOORS':
          setState((previous) => ({
            ...previous,
            screen: 'decision',
            modal: null,
            waitingMessage: undefined,
            objective: 'Choose a door',
            aiThinking: false,
            aiThinkingMessage: undefined,
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

        case 'AI_THINKING':
          setState((previous) => ({
            ...previous,
            aiThinking: Boolean(event.visible),
            aiThinkingMessage:
              typeof event.message === 'string' ? event.message : 'Preparing the next decision...',
            objective: event.visible ? 'Walk through the corridor' : previous.objective,
            modal: event.visible ? null : previous.modal,
          }));
          break;

        case 'OBJECTIVE':
          setState((previous) => ({
            ...previous,
            objective: typeof event.objective === 'string' ? event.objective : previous.objective,
          }));
          break;

        case 'WAITING':
          setState((previous) => ({
            ...previous,
            modal: 'waiting',
            waitingMessage: typeof event.message === 'string' ? event.message : 'Waiting...',
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
            aiThinking: false,
            aiThinkingMessage: undefined,
            objective: 'Session complete',
            error: undefined,
          }));
          break;

        case 'ERROR':
          setState((previous) => ({
            ...previous,
            error: typeof event.message === 'string' ? event.message : 'Something went wrong.',
            elevatorWaiting: false,
            aiThinking: false,
            aiThinkingMessage: undefined,
          }));
          break;

        case 'TROPHY_PROXIMITY':
          setState((previous) => ({
            ...previous,
            trophyNear: Boolean(event.visible),
          }));
          break;

        case 'TROPHY_INTERACTED':
          setState((previous) => ({
            ...previous,
            trophyNear: false,
            trophySummaryOpen: true,
            trophyProblem: typeof event.problem === 'string' ? event.problem : undefined,
            summary: typeof event.summary === 'string' ? event.summary : undefined,
            docContent: typeof event.docContent === 'string' ? event.docContent : undefined,
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
      const scene = game?.scene.getScene('BootScene') as
        | {
            submitProblem?: (value: string) => void;
          }
        | undefined;

      scene?.submitProblem?.(problem);
    },
    [game],
  );

  const submitDoorContext = useCallback(
    (context?: string) => {
      const scene = game?.scene.getScene('GrillingScene') as
        | {
            confirmDoorSelection?: (value?: string) => void;
          }
        | undefined;

      scene?.confirmDoorSelection?.(context);
    },
    [game],
  );

  const cancelDoorContext = useCallback(() => {
    const scene = game?.scene.getScene('GrillingScene') as
      | {
          cancelDoorSelection?: () => void;
        }
      | undefined;

    scene?.cancelDoorSelection?.();
  }, [game]);

  const closeTrophySummary = useCallback(() => {
    const scene = game?.scene.getScene('TrophyScene');

    if (scene) {
      const trophyScene = scene as unknown as {
        closeSummary?: () => void;
      };

      trophyScene.closeSummary?.();
    }

    setState((previous) => ({
      ...previous,
      trophySummaryOpen: false,
    }));
  }, [game, setState]);

  const showDecisionUI = state.screen === 'decision' && state.modal === null && !state.aiThinking;

  const latestDecisionHistory = state.decisionHistory;

  return (
    <>
      <HUD round={state.screen === 'decision' ? state.round : undefined} />

      <div className="objective-indicator">
        <div className="objective-indicator__eyebrow">OBJECTIVE</div>

        <div className="objective-indicator__text">{state.objective || 'Explore the room'}</div>
      </div>

      <DecisionBriefPanel
        question={state.question}
        description={state.description}
        options={state.options}
        recommendation={state.recommendation}
        round={state.round}
        decisionHistory={latestDecisionHistory}
        aiThinking={state.aiThinking}
        aiThinkingMessage={state.aiThinkingMessage}
      />

      <DoorOptionsOverlay game={game} visible={showDecisionUI} />

      <InteractionPrompt
        visible={state.doorNear && state.modal === null}
        text={
          state.nearDoorOption
            ? `Press E to enter ${state.nearDoorOption.label}`
            : 'Press E to enter the door'
        }
      />

      <InteractionPrompt
        visible={state.trophyNear && !state.trophySummaryOpen}
        text="Press E to view summary"
      />

      <ProblemInput
        open={state.screen === 'start'}
        waiting={state.modal === 'problem-input' && Boolean(state.waitingMessage)}
        onSubmit={submitProblem}
        error={state.error}
      />

      <DoorContextModal
        open={state.modal === 'door-context'}
        option={state.selectedOption}
        onSubmit={submitDoorContext}
        onCancel={cancelDoorContext}
      />

      <WaitingOverlay
        open={state.modal === 'waiting' && !state.aiThinking}
        message={state.waitingMessage}
      />

      <TrophySummary
        open={state.trophySummaryOpen}
        problem={state.trophyProblem}
        summary={state.summary}
        docContent={state.docContent}
        onClose={closeTrophySummary}
      />

      {state.error && <div className="game-error">{state.error}</div>}
    </>
  );
}
