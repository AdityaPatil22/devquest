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

const CHALLENGES: Record<string, string> = {
  'dev-node-1':
    'You chose a modular monolith over microservices. What specific risks would microservices introduce at this stage of the project?',
  'dev-node-2':
    'You are adding Redis as a caching layer. Walk me through your cache invalidation strategy — when does a cached entry become stale?',
  'dev-node-3':
    'With Docker + Kubernetes, how do you ensure zero-downtime deployments when pushing a new version?',
};

const EVALUATIONS: Record<string, { feedback: string; consequence: string }> = {
  'dev-node-1': {
    feedback:
      'Solid reasoning. You correctly identified distributed tracing, network latency, and service-to-service auth as the primary microservice risks at early stage.',
    consequence:
      'Your modular monolith will be significantly easier to refactor into services once traffic patterns are well understood.',
  },
  'dev-node-2': {
    feedback:
      'Good answer. TTL-based invalidation combined with event-driven cache busting on writes covers the main invalidation scenarios.',
    consequence:
      'Your data layer handles read-heavy workloads efficiently without overcomplicating the write path.',
  },
  'dev-node-3': {
    feedback:
      'Correct. Rolling deployments with readiness probes and a pod disruption budget ensure no user sees a 502 during the rollout window.',
    consequence:
      'Your deployment pipeline can ship multiple times per day without scheduling downtime windows.',
  },
};

const SESSION_SUMMARY =
  'You made three strong architectural decisions: a modular monolith backend, a PostgreSQL + Redis data layer, and Docker + Kubernetes deployment with rolling updates. The system is well-positioned for growth.';

const SESSION_DOC = `# Feature Implementation Plan

## Architecture
**Modular Monolith** — clear domain boundaries enforced by module interfaces, no cross-domain DB queries.

## Data Layer
**PostgreSQL** for persistent structured data. **Redis** for hot-path caching with TTL + event-driven invalidation on writes.

## Deployment
**Docker + Kubernetes** — containerised services with rolling deployments, readiness probes, and a pod disruption budget to eliminate downtime windows.

## Next Steps
1. Define module boundaries and shared interfaces
2. Provision PostgreSQL and Redis instances
3. Write Dockerfiles for each module
4. Set up the Kubernetes manifests and CI/CD pipeline
`;

// ---------------------------------------------------------------------------
// Dev WebSocket client
// ---------------------------------------------------------------------------

export class DevWebSocketClient extends WebSocketClient {
  /** Index into MOCK_ROUNDS — incremented after each EVALUATION. */
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
      case 'PROBLEM_SUBMITTED':
        this.roundIndex = 0;
        this.fireDecision(0, 1500);
        break;

      case 'OPTION_SELECTED':
        this.fireChallenge(msg.nodeId, 2000);
        break;

      case 'CHALLENGE_RESPONSE':
        this.fireEvaluationThenNext(msg.nodeId, 1500);
        break;

      default:
        break;
    }
  }

  // -------------------------------------------------------------------------

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

  private fireChallenge(nodeId: string, delay: number): void {
    const question =
      CHALLENGES[nodeId] ??
      'Explain your reasoning for this choice in more detail.';

    setTimeout(() => {
      console.log('[DEV WS] ← CHALLENGE');
      this.dispatch({
        type: 'CHALLENGE',
        nodeId,
        question,
      });
    }, delay);
  }

  private fireEvaluationThenNext(nodeId: string, delay: number): void {
    const ev = EVALUATIONS[nodeId] ?? {
      feedback: 'Good thinking — your reasoning is sound.',
      consequence: 'This decision shapes the next architectural question.',
    };

    setTimeout(() => {
      console.log('[DEV WS] ← EVALUATION');
      this.dispatch({
        type: 'EVALUATION',
        nodeId,
        feedback: ev.feedback,
        consequence: ev.consequence,
      });

      this.roundIndex += 1;

      const nextDecision = MOCK_ROUNDS[this.roundIndex];

      if (nextDecision) {
        // Next round — fire after a short pause so the
        // evaluation UI has time to render before the
        // player is asked to move again.
        setTimeout(() => {
          console.log(`[DEV WS] ← DECISION_CREATED round ${nextDecision.round}`);
          this.dispatch(nextDecision);
        }, 800);
      } else {
        // All rounds done — complete the session.
        setTimeout(() => {
          console.log('[DEV WS] ← SESSION_COMPLETE');
          this.dispatch({
            type: 'SESSION_COMPLETE',
            summary: SESSION_SUMMARY,
            decisionsCount: MOCK_ROUNDS.length,
            reconsideredCount: 0,
            docContent: SESSION_DOC,
          });
        }, 800);
      }
    }, delay);
  }
}
