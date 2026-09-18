import type { DecisionOption, Recommendation } from '../net/protocol';

export interface DecisionRecord {
  nodeId: string;
  question: string;
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

/**
 * Client-side mirror of the session state.
 * Server is the source of truth.
 */
export class SessionStore {
  sessionId?: string;
  problem?: string;
  currentNodeId?: string;
  decisions: DecisionRecord[] = [];
  totalRounds = 0;
  finished = false;
  docContent?: string;
  summary?: string;

  reset(): void {
    this.sessionId = undefined;
    this.problem = undefined;
    this.currentNodeId = undefined;
    this.decisions = [];
    this.totalRounds = 0;
    this.finished = false;
    this.docContent = undefined;
    this.summary = undefined;
  }

  setSession(sessionId: string): void {
    this.reset();
    this.sessionId = sessionId;
  }

  setProblem(problem: string): void {
    this.problem = problem;
  }

  addDecision(record: DecisionRecord): void {
    this.decisions.push(record);
    this.currentNodeId = record.nodeId;
    this.totalRounds = Math.max(this.totalRounds, record.round);
  }

  getCurrentDecision(): DecisionRecord | undefined {
    return this.decisions.find((d) => d.nodeId === this.currentNodeId);
  }

  updateCurrent(update: Partial<DecisionRecord>): void {
    const current = this.getCurrentDecision();
    if (current) {
      Object.assign(current, update);
    }
  }

  complete(summary: string, docContent: string): void {
    this.finished = true;
    this.summary = summary;
    this.docContent = docContent;
  }
}
