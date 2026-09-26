import { WebSocketClient } from '../net/WebSocketClient';
import type {
  ClientMessage,
  DecisionCreatedMsg,
} from '../net/protocol';

const INITIAL_DECISION_DELAY_MS = 500;
const NEXT_DECISION_DELAY_MS = 3000;
const SESSION_COMPLETE_DELAY_MS = 500;

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
      why: 'A modular monolith gives clean separation without unnecessary operational complexity.',
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
      { id: 'option-c', label: 'PostgreSQL + Redis' },
      { id: 'option-d', label: 'SQLite' },
    ],
    recommendation: {
      option: 'option-c',
      why: 'PostgreSQL handles durable data while Redis handles hot reads.',
    },
    round: 2,
  },

  {
    type: 'DECISION_CREATED',
    nodeId: 'dev-node-3',
    question: 'What deployment strategy should we use?',
    options: [
      { id: 'option-a', label: 'Docker + Kubernetes' },
      { id: 'option-b', label: 'Virtual Machines' },
      { id: 'option-c', label: 'Serverless' },
      { id: 'option-d', label: 'PaaS' },
    ],
    recommendation: {
      option: 'option-a',
      why: 'Containerized deployment provides portability and predictable environments.',
    },
    round: 3,
  },
];

const SESSION_SUMMARY =
  'You made three strong architectural decisions: a modular monolith backend, a PostgreSQL + Redis data layer, and Docker + Kubernetes deployment.';

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

type Timer = ReturnType<typeof setTimeout>;

export class DevWebSocketClient extends WebSocketClient {
  private roundIndex = 0;
  private mockConnected = false;
  private timers = new Set<Timer>();

  override connect(): void {
    if (this.mockConnected) {
      return;
    }

    this.mockConnected = true;

    this.schedule(() => {
      this.dispatch({
        type: 'SESSION_STARTED',
        sessionId: 'dev-session-001',
      });
    }, 0);
  }

  override disconnect(): void {
    this.mockConnected = false;

    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  override get connected(): boolean {
    return this.mockConnected;
  }

  override send(msg: ClientMessage): void {
    if (!this.mockConnected) {
      return;
    }

    switch (msg.type) {
      case 'PROBLEM_SUBMITTED':
        this.roundIndex = 0;
        this.scheduleDecision(0, INITIAL_DECISION_DELAY_MS);
        break;

      case 'OPTION_SELECTED':
        this.roundIndex += 1;

        if (this.roundIndex < MOCK_ROUNDS.length) {
          this.scheduleDecision(
            this.roundIndex,
            NEXT_DECISION_DELAY_MS,
          );
        } else {
          this.scheduleComplete(SESSION_COMPLETE_DELAY_MS);
        }

        break;

      default:
        break;
    }
  }

  private scheduleDecision(
    index: number,
    delay: number,
  ): void {
    const decision = MOCK_ROUNDS[index];

    if (!decision) {
      return;
    }

    this.schedule(() => {
      this.dispatch(decision);
    }, delay);
  }

  private scheduleComplete(delay: number): void {
    this.schedule(() => {
      this.dispatch({
        type: 'SESSION_COMPLETE',
        summary: SESSION_SUMMARY,
        decisionsCount: MOCK_ROUNDS.length,
        reconsideredCount: 0,
        docContent: SESSION_DOC,
      });
    }, delay);
  }

  private schedule(
    callback: () => void,
    delay: number,
  ): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);

    this.timers.add(timer);
  }
}

