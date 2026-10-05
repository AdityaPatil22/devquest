import { useCallback, useEffect, useState } from 'react';
import type { DecisionOption } from '../net/protocol';
import type { DecisionHistoryEntry } from '../game/GameBridge';
import type { WebSocketStatus } from '../net/WebSocketClient';
import { useGameUI } from '../state/GameUIContext';
import { HUD } from './HUD/HUD';
import { InteractionPrompt } from './InteractionPrompt/InteractionPrompt';
import { ProblemInput } from './ProblemInput/ProblemInput';
import { DoorContextModal } from './DecisionPanel/DoorContextModal';
import { DoorOptionsOverlay } from './DoorOptionsOverlay/DoorOptionsOverlay';
import { WaitingOverlay } from './WaitingOverlay/WaitingOverlay';
import { TrophySummary } from './TrophySummary/TrophySummary';
import { DecisionBriefPanel } from './DecisionBriefPanel/DecisionBriefPanel';
import { DecisionHistoryPanel } from './DecisionHistoryPanel/DecisionHistoryPanel';
import { AIWorkstation } from './AIWorkstation/AIWorkstation';

type BackendStatus = 'checking' | 'online' | 'offline';

function StatusDot({ status }: { status: BackendStatus | WebSocketStatus | 'ready' }) {
  const healthy = status === 'online' || status === 'connected' || status === 'ready';
  const warning = status === 'checking' || status === 'connecting';

  return (
    <span
      className={[
        'system-status__dot',
        healthy ? 'system-status__dot--healthy' : '',
        warning ? 'system-status__dot--warning' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

function StatusRow({
  label,
  status,
  value,
}: {
  label: string;
  status: BackendStatus | WebSocketStatus | 'ready';
  value: string;
}) {
  return (
    <div className="system-status__row">
      <div className="system-status__label">
        <StatusDot status={status} />
        <span>{label}</span>
      </div>
      <span className="system-status__value">{value}</span>
    </div>
  );
}

interface GameUIEvent {
  type: string;
  [key: string]: unknown;
}

export function GameUI() {
  const { game, state, setState } = useGameUI();
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>('disconnected');
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    let active = true;

    const checkBackend = async () => {
      try {
        const response = await fetch('/api/health', { method: 'GET', cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const body = (await response.json()) as { status?: string };

        if (active) {
          setBackendStatus(body.status === 'ok' ? 'online' : 'offline');
        }
      } catch {
        if (active) {
          setBackendStatus('offline');
        }
      }
    };

    void checkBackend();
    const interval = window.setInterval(() => void checkBackend(), 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
          setState((previous) => ({ ...previous, gameReady: true, loading: false }));
          break;
        case 'WEBSOCKET_STATUS':
          setWebsocketStatus(event.status as WebSocketStatus);
          break;
        case 'START_SCREEN_READY':
          setState((previous) => ({
            ...previous,
            screen: 'start',
            modal: null,
            loading: false,
            waitingMessage: undefined,
            objective: '',
            aiThinking: false,
            aiThinkingMessage: undefined,
            corridorProcessing: false,
            corridorProcessingStage: 'processing',
            corridorProcessingMessage: undefined,
            finalDocumentGenerating: false,
            finalDocumentGeneratingMessage: undefined,
            workstationNear: false,
            workstationType: undefined,
            workstationOpen: false,
            error: undefined,
          }));
          break;
        case 'SESSION_STARTED':
          setState((previous) => ({
            ...previous,
            screen: 'start',
            modal: null,
            loading: false,
            decisionHistory: [],
            waitingMessage: undefined,
            objective: '',
            aiThinking: false,
            aiThinkingMessage: undefined,
            corridorProcessing: false,
            corridorProcessingStage: 'processing',
            corridorProcessingMessage: undefined,
            finalDocumentGenerating: false,
            finalDocumentGeneratingMessage: undefined,
            workstationNear: false,
            workstationType: undefined,
            workstationOpen: false,
            error: undefined,
          }));
          break;
        case 'SESSION_RESUMED':
          setState((previous) => ({ ...previous, loading: false, error: undefined }));
          break;
        case 'PROBLEM_SUBMITTING':
          setState((previous) => ({
            ...previous,
            screen: 'start',
            modal: null,
            waitingMessage:
              typeof event.message === 'string' ? event.message : 'Generating your first decision...',
            finalDocumentGenerating: false,
            finalDocumentGeneratingMessage: undefined,
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
            corridorProcessing: false,
            corridorProcessingStage: 'processing',
            corridorProcessingMessage: undefined,
            finalDocumentGenerating: false,
            finalDocumentGeneratingMessage: undefined,
            workstationNear: false,
            workstationType: undefined,
            workstationOpen: false,
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
              return { ...previous, decisionHistory: [...previous.decisionHistory, entry] };
            }

            const decisionHistory = [...previous.decisionHistory];
            decisionHistory[existingIndex] = entry;
            return { ...previous, decisionHistory };
          });
          break;
        }
        case 'EXPLORING_DOORS':
          setState((previous) => ({
            ...previous,
            screen: 'decision',
            modal: null,
            waitingMessage: undefined,
            objective: 'Choose a door',
            aiThinking: false,
            aiThinkingMessage: undefined,
            corridorProcessing: false,
            corridorProcessingStage: 'processing',
            corridorProcessingMessage: undefined,
            finalDocumentGenerating: false,
            finalDocumentGeneratingMessage: undefined,
            workstationNear: false,
            workstationType: undefined,
            workstationOpen: false,
            error: undefined,
          }));
          break;
        case 'DOOR_PROXIMITY':
          setState((previous) => ({
            ...previous,
            doorNear: Boolean(event.visible),
            nearDoorOption: event.option as DecisionOption | undefined,
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
          setState((previous) => {
            if (previous.finalDocumentGenerating) {
              return previous;
            }

            return {
              ...previous,
              aiThinking: Boolean(event.visible),
              aiThinkingMessage:
                typeof event.message === 'string' ? event.message : 'Preparing the next decision...',
              objective: event.visible ? 'Walk through the corridor' : previous.objective,
              modal: event.visible ? null : previous.modal,
            };
          });
          break;
        case 'CORRIDOR_PROCESSING':
          setState((previous) => {
            if (previous.finalDocumentGenerating) {
              return previous;
            }

            return {
              ...previous,
              corridorProcessing: Boolean(event.visible),
              corridorProcessingStage:
                event.stage === 'ready' ? 'ready' : event.stage === 'received' ? 'received' : 'processing',
              corridorProcessingMessage:
                typeof event.message === 'string' ? event.message : undefined,
              workstationNear: Boolean(event.visible) ? previous.workstationNear : false,
              workstationType: Boolean(event.visible) ? previous.workstationType : undefined,
              workstationOpen: Boolean(event.visible) ? previous.workstationOpen : false,
            };
          });
          break;
        case 'FINAL_DOCUMENT_GENERATING':
          setState((previous) => ({
            ...previous,
            screen: 'decision',
            modal: null,
            waitingMessage: undefined,
            aiThinking: false,
            aiThinkingMessage: undefined,
            corridorProcessing: false,
            corridorProcessingStage: 'processing',
            corridorProcessingMessage: undefined,
            finalDocumentGenerating: true,
            finalDocumentGeneratingMessage:
              typeof event.message === 'string'
                ? event.message
                : 'Claude is generating your implementation plan...',
            workstationNear: false,
            workstationType: undefined,
            workstationOpen: false,
            objective: 'Reach the document',
            error: undefined,
          }));
          break;
        case 'WORKSTATION_PROXIMITY':
          setState((previous) => {
            if (previous.finalDocumentGenerating) {
              return previous;
            }

            return {
              ...previous,
              workstationNear: Boolean(event.visible),
              workstationType:
                event.workstation === 'ai-terminal' || event.workstation === 'ai-workstation'
                  ? event.workstation
                  : undefined,
            };
          });
          break;
        case 'WORKSTATION_OPEN':
          setState((previous) => {
            if (previous.finalDocumentGenerating) {
              return previous;
            }

            return {
              ...previous,
              workstationOpen: Boolean(event.visible),
              workstationType:
                event.workstation === 'ai-terminal' || event.workstation === 'ai-workstation'
                  ? event.workstation
                  : previous.workstationType,
            };
          });
          break;
        case 'PLAYER_MOVING':
          break;
        case 'OBJECTIVE':
          setState((previous) => {
            if (previous.finalDocumentGenerating) {
              return previous;
            }

            return {
              ...previous,
              objective: typeof event.objective === 'string' ? event.objective : previous.objective,
            };
          });
          break;
        case 'WAITING':
          setState((previous) => {
            if (previous.finalDocumentGenerating) {
              return previous;
            }

            return {
              ...previous,
              modal: 'waiting',
              waitingMessage: typeof event.message === 'string' ? event.message : 'Waiting...',
            };
          });
          break;
        case 'NEXT_DECISION_LOADING':
          setState((previous) => {
            if (previous.finalDocumentGenerating) {
              return previous;
            }

            return {
              ...previous,
              modal: 'waiting',
              waitingMessage: 'Preparing the next decision...',
            };
          });
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
            corridorProcessing: false,
            finalDocumentGenerating: false,
            finalDocumentGeneratingMessage: undefined,
            workstationNear: false,
            workstationOpen: false,
            objective: 'Session complete',
            error: undefined,
          }));
          break;
        case 'ERROR':
          setState((previous) => ({
            ...previous,
            error: typeof event.message === 'string' ? event.message : 'Something went wrong.',
            waitingMessage: undefined,
            aiThinking: false,
            aiThinkingMessage: undefined,
            corridorProcessing: false,
            finalDocumentGenerating: false,
            finalDocumentGeneratingMessage: undefined,
            workstationNear: false,
            workstationOpen: false,
          }));
          break;
        case 'TROPHY_PROXIMITY':
          setState((previous) => ({ ...previous, trophyNear: Boolean(event.visible) }));
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
        default:
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
        | { submitProblem?: (value: string) => void }
        | undefined;
      scene?.submitProblem?.(problem);
    },
    [game],
  );

  const submitDoorContext = useCallback(
    (context?: string) => {
      const scene = game?.scene.getScene('GrillingScene') as
        | { confirmDoorSelection?: (value?: string) => void }
        | undefined;
      scene?.confirmDoorSelection?.(context);
    },
    [game],
  );

  const cancelDoorContext = useCallback(() => {
    const scene = game?.scene.getScene('GrillingScene') as
      | { cancelDoorSelection?: () => void }
      | undefined;
    scene?.cancelDoorSelection?.();
  }, [game]);

  const closeWorkstation = useCallback(() => {
    const scene = game?.scene.getScene('GrillingScene') as
      | { closeWorkstation?: () => void }
      | undefined;
    scene?.closeWorkstation?.();
  }, [game]);

  const closeTrophySummary = useCallback(() => {
    const scene = game?.scene.getScene('TrophyScene');

    if (scene) {
      const trophyScene = scene as unknown as { closeSummary?: () => void };
      trophyScene.closeSummary?.();
    }

    setState((previous) => ({ ...previous, trophySummaryOpen: false }));
  }, [game, setState]);

  const showStartScreen = state.screen === 'start';
  const showDecisionScreen = state.screen === 'decision';
  const showTrophyScreen = state.screen === 'complete';
  const showDecisionUI =
    showDecisionScreen &&
    state.modal === null &&
    !state.aiThinking &&
    !state.corridorProcessing &&
    !state.finalDocumentGenerating;
  const initialProblemWaiting = showStartScreen && Boolean(state.waitingMessage);
  const processingLabel =
    state.corridorProcessingStage === 'ready'
      ? 'NEXT DECISION READY'
      : state.corridorProcessingStage === 'received'
        ? 'REQUEST RECEIVED'
        : 'AI PROCESSING';

  if (showStartScreen) {
    return (
      <div className="start-screen">
        <header className="start-screen__header">
          <div className="start-screen__brand">DEVQUEST</div>
        </header>
        <main className="start-screen__content">
          <section className="start-screen__intro">
            <div className="start-screen__eyebrow">AI ENGINEERING PLANNING WORKSPACE</div>
            <h1>
              Think it through.
              <br />
              Then build the plan.
            </h1>
            <p className="start-screen__description">
              DevQuest works with you to turn an engineering problem into a concrete implementation
              plan, one decision at a time.
            </p>
            <div className="start-screen__instructions">
              <div className="start-screen__section-title">HOW IT WORKS</div>
              <div className="instruction-list">
                <div className="instruction">
                  <span>01</span>
                  <div>
                    <strong>Enter your problem</strong>
                    <p>Describe the engineering feature, system, or decision you are working on.</p>
                  </div>
                </div>
                <div className="instruction">
                  <span>02</span>
                  <div>
                    <strong>Choose a door</strong>
                    <p>Each door represents a different technical path or trade-off.</p>
                  </div>
                </div>
                <div className="instruction">
                  <span>03</span>
                  <div>
                    <strong>Build the plan</strong>
                    <p>Resolve the decisions that shape the implementation.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="system-status">
              <div className="start-screen__section-title">SYSTEM STATUS</div>
              <StatusRow label="Frontend" status={state.gameReady ? 'ready' : 'checking'} value={state.gameReady ? 'Ready' : 'Loading'} />
              <StatusRow
                label="Backend"
                status={backendStatus}
                value={backendStatus === 'online' ? 'Healthy' : backendStatus === 'checking' ? 'Checking' : 'Offline'}
              />
              <StatusRow
                label="WebSocket"
                status={websocketStatus}
                value={
                  websocketStatus === 'connected'
                    ? 'Connected'
                    : websocketStatus === 'connecting'
                      ? 'Connecting'
                      : websocketStatus === 'error'
                        ? 'Error'
                        : 'Disconnected'
                }
              />
            </div>
          </section>
          <section className="start-screen__input">
            <ProblemInput
              waiting={initialProblemWaiting}
              message={state.waitingMessage}
              error={state.error}
              onSubmit={submitProblem}
            />
            <div className="start-screen__note">No account required. Your session is kept locally while you play.</div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <>
      {showDecisionScreen && <HUD />}
      {showDecisionScreen && (
        <div className="objective-indicator">
          <div className="objective-indicator__eyebrow">OBJECTIVE</div>
          <div className="objective-indicator__text">{state.objective || 'Explore the room'}</div>
        </div>
      )}
      {state.finalDocumentGenerating ? (
        <div className="corridor-processing-indicator">
          <span className="corridor-processing-indicator__dot" />
          <span className="corridor-processing-indicator__label">
            DOCUMENT GENERATING
            {state.finalDocumentGeneratingMessage ? ` — ${state.finalDocumentGeneratingMessage}` : ''}
          </span>
        </div>
      ) : (
        state.corridorProcessing &&
        !state.workstationOpen && (
          <div className="corridor-processing-indicator">
            <span className="corridor-processing-indicator__dot" />
            <span className="corridor-processing-indicator__label">
              {processingLabel}
              {state.corridorProcessingMessage ? ` — ${state.corridorProcessingMessage}` : ''}
            </span>
          </div>
        )
      )}
      {showDecisionScreen && (
        <DecisionBriefPanel
          question={state.question}
          description={state.description}
          options={state.options}
          recommendation={state.recommendation}
          round={state.round}
          decisionHistory={state.decisionHistory}
          aiThinking={state.aiThinking}
          aiThinkingMessage={state.aiThinkingMessage}
        />
      )}
      {showTrophyScreen && <DecisionHistoryPanel decisionHistory={state.decisionHistory} />}
      <DoorOptionsOverlay game={game} visible={showDecisionUI} />
      <InteractionPrompt
        visible={
          showDecisionScreen &&
          state.doorNear &&
          state.modal === null &&
          !state.corridorProcessing &&
          !state.finalDocumentGenerating
        }
        text={
          state.nearDoorOption
            ? `Press E to enter ${state.nearDoorOption.label}`
            : 'Press E to enter the door'
        }
      />
      <InteractionPrompt
        visible={
          showDecisionScreen &&
          state.workstationNear &&
          state.corridorProcessing &&
          !state.workstationOpen &&
          !state.finalDocumentGenerating
        }
        text={state.workstationType === 'ai-terminal' ? 'Press E to inspect terminal' : 'Press E to inspect workstation'}
      />
      <AIWorkstation
        open={showDecisionScreen && state.workstationOpen && !state.finalDocumentGenerating}
        type={state.workstationType}
        stage={state.corridorProcessingStage}
        message={state.corridorProcessingMessage}
        onClose={closeWorkstation}
      />
      <InteractionPrompt
        visible={showTrophyScreen && state.trophyNear && !state.trophySummaryOpen && !state.finalDocumentGenerating}
        text="Press E to view summary"
      />
      <DoorContextModal
        open={
          showDecisionScreen &&
          state.modal === 'door-context' &&
          !state.corridorProcessing &&
          !state.finalDocumentGenerating
        }
        option={state.selectedOption}
        onSubmit={submitDoorContext}
        onCancel={cancelDoorContext}
      />
      <WaitingOverlay
        open={showDecisionScreen && state.modal === 'waiting' && !state.aiThinking && !state.finalDocumentGenerating}
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
