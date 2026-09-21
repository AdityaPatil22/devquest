export interface MockDecision {
  question: string;
  options: string[];
}

export const MOCK_DECISION: MockDecision = {
  question: 'Which approach should we take?',
  options: [
    'Build it from scratch',
    'Reuse the existing implementation',
    'Create a hybrid solution',
    'Investigate further',
  ],
};

export function getMockDecision(): MockDecision {
  return {
    question: MOCK_DECISION.question,
    options: [...MOCK_DECISION.options],
  };
}
