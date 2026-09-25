import { WebSocketClient } from '../net/WebSocketClient';
import type { ClientMessage, DecisionCreatedMsg } from '../net/protocol';

// ---------------------------------------------------------------------------
// Scripted mock rounds
// ---------------------------------------------------------------------------

const MOCK_ROUNDS: DecisionCreatedMsg[] = [
  {
    type: 'DECISION_CREATED',
    nodeId: 'dev-node-1',
    question: 'Which backend architecture pattern should we use?',
    options: [
      { id: 'option-a', label: 'Traditional Monolith' },
      { id: 'option-b', label: 'Microservices' },
      { id: 'option-c', label: 'Modular Monolith' },
      { id: 'option-d', label: 'Serverless Functions' },
    ],
    recommendation: {
      option: 'option-c',
      why: 'A modular monolith gives clean separation without the operational overhead of microservices at this stage.',
    },
    round: 1,
  },

  {
    type: 'DECISION_CREATED',
    nodeId: 'dev-node-2',
    question: 'How should we handle data persistence and caching?',
    options: [
      { id: 'option-a', label: 'PostgreSQL only' },
      { id: 'option-b', label: 'MongoDB only' },
      { id: 'option-c', label: 'PostgreSQL + Redis cache' },
      { id: 'option-d', label: 'SQLite for simplicity' },
    ],
    recommendation: {
      option: 'option-c',
      why: 'PostgreSQL handles structured data; Redis cuts read latency on hot paths.',
    },
    round: 2,
  },

  {
    type: 'DECISION_CREATED',
    nodeId: 'dev-node-3',
    question: 'What deployment strategy should we adopt?',
    options: [
      { id: 'option-a', label: 'Docker + Kubernetes' },
      { id: 'option-b', label: 'Traditional VMs' },
      { id: 'option-c', label: 'Serverless (Lambda / Cloud Run)' },
      { id: 'option-d', label: 'PaaS (Railway / Render)' },
    ],
    recommendation: {
      option: 'option-a',
      why: 'Docker + K8s gives portability and rolling deployments as traffic grows.',
    },
    round: 3,
  },
];

const SESSION_SUMMARY =
  'You made three strong architectural decisions: a modular monolith backend, a PostgreSQL + Redis data layer, and Docker + Kubernetes deployment with rolling updates.';

const SESSION_DOC = `# Feature Implementation Plan

## Architecture
**Modular Monolith**

## Data Layer
**PostgreSQL + Redis**

## Deployment
**Docker + Kubernetes**

## Next Steps
1. Define module boundaries
2. Provision PostgreSQL and Redis
3. Containerise the application
4. Configure Kubernetes deployment
`;

// ---------------------------------------------------------------------------
// Dev WebSocket client
// ---------------------------------------------------------------------------

export class DevWebSocketClient extends WebSocketClient {
  /**
   * Index of the currently active decision.
   *
   * Round 1 => 0
   * Round 2 => 1
   * Round 3 => 2
   */
  private roundIndex = 0;

  override connect(): void {
    console.log('[DEV WS] Mock connected — firing SESSION_STARTED');

    setTimeout(() => {
      this.dispatch({
        type: 'SESSION_STARTED',
        sessionId: 'dev-session-001',
      });
    }, 600);
  }

  override disconnect(): void {
    console.log('[DEV WS] Mock disconnected');
  }

  override get connected(): boolean {
    return true;
  }

  override send(msg: ClientMessage): void {
    console.log('[DEV WS] →', msg.type, msg);

    switch (msg.type) {
      // ---------------------------------------------------------------
      // Problem submitted from Common Room
      // ---------------------------------------------------------------

      case 'PROBLEM_SUBMITTED': {
        this.roundIndex = 0;

        this.fireDecision(0, 1200);

        break;
      }

      // ---------------------------------------------------------------
      // Player selected a door.
      //
      // IMPORTANT:
      // There is NO challenge here anymore.
      //
      // The selected option simply advances the decision graph.
      // ---------------------------------------------------------------

      case 'OPTION_SELECTED': {
        console.log(`[DEV WS] Option selected: ${msg.optionId} for ${msg.nodeId}`);

        this.roundIndex += 1;

        const nextDecision = MOCK_ROUNDS[this.roundIndex];

        if (nextDecision) {
          // The player is now expected to walk through the
          // corridor before reaching the next decision room.
          //
          // We only provide the next decision data here.
          this.fireDecisionAtEndOfTraversal(nextDecision);
        } else {
          // No more decisions.
          this.fireSessionComplete();
        }

        break;
      }

      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Decision
  // ---------------------------------------------------------------------------

  private fireDecision(index: number, delay: number): void {
    const decision = MOCK_ROUNDS[index];

    if (!decision) {
      return;
    }

    setTimeout(() => {
      console.log(`[DEV WS] ← DECISION_CREATED round ${decision.round}`);

      this.dispatch(decision);
    }, delay);
  }

  /**
   * Sends the next decision after a small delay.
   *
   * The delay represents the transition/loading period.
   * The actual player movement through the corridor remains
   * handled by Phaser.
   */
  private fireDecisionAtEndOfTraversal(decision: DecisionCreatedMsg): void {
    setTimeout(() => {
      console.log(`[DEV WS] ← DECISION_CREATED round ${decision.round}`);

      this.dispatch(decision);
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Session complete
  // ---------------------------------------------------------------------------

  private fireSessionComplete(): void {
    setTimeout(() => {
      console.log('[DEV WS] ← SESSION_COMPLETE');

      this.dispatch({
        type: 'SESSION_COMPLETE',
        summary: SESSION_SUMMARY,
        decisionsCount: MOCK_ROUNDS.length,
        reconsideredCount: 0,
        docContent: SESSION_DOC,
      });
    }, 500);
  }
}
