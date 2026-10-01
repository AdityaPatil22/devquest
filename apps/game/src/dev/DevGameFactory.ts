import { SessionStore } from '../state/SessionStore';

import type { DecisionCreatedMsg } from '../net/protocol';

import { DevWebSocketClient } from './DevWebSocketClient';

export function createDevGameState() {
  const store = new SessionStore();

  const ws = new DevWebSocketClient();

  const decision: DecisionCreatedMsg = {
    type: 'DECISION_CREATED',

    nodeId: 'dev-node-1',

    question: 'Which approach should we take for this feature?',

    description: '',

    options: [
      { id: 'option-a', label: 'Build it from scratch', description: '' },
      { id: 'option-b', label: 'Reuse the existing implementation', description: '' },
      { id: 'option-c', label: 'Create a hybrid solution', description: '' },
      { id: 'option-d', label: 'Investigate further', description: '' },
    ],

    recommendation: {
      option: 'option-c',
      why: 'A hybrid approach gives us flexibility while reusing proven components.',
    },

    round: 1,
  };

  store.setSession('dev-session');

  store.setProblem('How should we implement this feature?');

  store.addDecision({
    nodeId: decision.nodeId,
    question: decision.question,
    description: decision.description ?? '',
    options: decision.options,
    recommendation: decision.recommendation,
    round: decision.round,
  });

  return {
    ws,
    store,
    decision,
  };
}
