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
  private roundIndex = 0;

  override connect(): void {
    setTimeout(() => {
      this.dispatch({
        type: 'SESSION_STARTED',
        sessionId: 'dev-session-001',
      });
    }, 0);
  }

  override disconnect(): void {}

  override get connected(): boolean {
    return true;
  }

  override send(msg: ClientMessage): void {
    switch (msg.type) {
      case 'PROBLEM_SUBMITTED':
        this.roundIndex = 0;
        this.scheduleDecision(0, 300);
        break;

      case 'OPTION_SELECTED':
        this.roundIndex += 1;

        if (this.roundIndex < MOCK_ROUNDS.length) {
          this.scheduleDecision(this.roundIndex, 300);
        } else {
          this.scheduleComplete();
        }
        break;
    }
  }

  private scheduleDecision(index: number, delay: number): void {
    const decision = MOCK_ROUNDS[index];

    if (!decision) {
      return;
    }

    setTimeout(() => {
      this.dispatch(decision);
    }, delay);
  }

  private scheduleComplete(): void {
    setTimeout(() => {
      this.dispatch({
        type: 'SESSION_COMPLETE',
        summary: 'Dev session completed successfully.',
        decisionsCount: MOCK_ROUNDS.length,
        reconsideredCount: 0,
        docContent: '# DevQuest Session\n\nMock session completed.',
      });
    }, 300);
  }
}
