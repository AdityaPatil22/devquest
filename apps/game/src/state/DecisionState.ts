import type { DecisionOption, Recommendation } from '../net/protocol';

export interface DecisionStateData {
  nodeId?: string;
  question?: string;
  options: DecisionOption[];
  recommendation?: Recommendation;
  round: number;
  selectedOptionId?: string;
  context?: string;
  challenge?: string;
  defense?: string;
  feedback?: string;
  consequence?: string;
}

export class DecisionState {
  private data: DecisionStateData = {
    options: [],
    round: 0,
  };

  reset(): void {
    this.data = {
      options: [],
      round: 0,
    };
  }

  setDecision(
    input: Omit<
      DecisionStateData,
      'selectedOptionId' | 'context' | 'challenge' | 'defense' | 'feedback' | 'consequence'
    >,
  ): void {
    this.data = {
      ...this.data,
      ...input,
      options: [...input.options],
    };
  }

  selectOption(optionId: string, context?: string): void {
    this.data.selectedOptionId = optionId;
    this.data.context = context;
  }

  setChallenge(challenge: string): void {
    this.data.challenge = challenge;
  }

  setDefense(defense: string): void {
    this.data.defense = defense;
  }

  setEvaluation(feedback: string, consequence: string): void {
    this.data.feedback = feedback;
    this.data.consequence = consequence;
  }

  get nodeId(): string | undefined { return this.data.nodeId; }
  get question(): string | undefined { return this.data.question; }
  get options(): DecisionOption[] { return [...this.data.options]; }
  get recommendation(): Recommendation | undefined {
    return this.data.recommendation ? { ...this.data.recommendation } : undefined;
  }
  get round(): number { return this.data.round; }
  get selectedOptionId(): string | undefined { return this.data.selectedOptionId; }
  get context(): string | undefined { return this.data.context; }
  get challenge(): string | undefined { return this.data.challenge; }
  get defense(): string | undefined { return this.data.defense; }
  get feedback(): string | undefined { return this.data.feedback; }
  get consequence(): string | undefined { return this.data.consequence; }

  snapshot(): DecisionStateData {
    return {
      nodeId: this.nodeId,
      question: this.question,
      options: this.options,
      recommendation: this.recommendation,
      round: this.round,
      selectedOptionId: this.selectedOptionId,
      context: this.context,
      challenge: this.challenge,
      defense: this.defense,
      feedback: this.feedback,
      consequence: this.consequence,
    };
  }
}
