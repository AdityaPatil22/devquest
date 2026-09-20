import type {
  DecisionOption,
  Recommendation,
  SessionSnapshot,
} from '../net/protocol';

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
    this.sessionId = sessionId;
  }

  setProblem(problem: string): void {
    this.problem = problem;
  }

  addDecision(record: DecisionRecord): void {
    const existing = this.decisions.find(
      (decision) => decision.nodeId === record.nodeId,
    );

    if (existing) {
      Object.assign(existing, record);
    } else {
      this.decisions.push(record);
    }

    this.currentNodeId = record.nodeId;
    this.totalRounds = Math.max(
      this.totalRounds,
      record.round,
    );
  }

  getCurrentDecision(): DecisionRecord | undefined {
    return this.decisions.find(
      (decision) => decision.nodeId === this.currentNodeId,
    );
  }

  updateCurrent(update: Partial<DecisionRecord>): void {
    const current = this.getCurrentDecision();

    if (current) {
      Object.assign(current, update);
    }
  }

  complete(
    summary: string,
    docContent: string,
  ): void {
    this.finished = true;
    this.summary = summary;
    this.docContent = docContent;
  }

  /**
   * Restore the client-side store from the authoritative
   * server-side session snapshot.
   */
  hydrate(snapshot: SessionSnapshot): void {
    this.sessionId = snapshot.sessionId;
    this.problem = snapshot.problem;
    this.currentNodeId = snapshot.currentNodeId;
    this.totalRounds = snapshot.round;

    this.decisions = snapshot.decisions.map(
      (node): DecisionRecord => ({
        nodeId: node.id,
        question: node.question,
        options: node.options,
        recommendation: node.recommendation,
        round: node.round,

        selectedOptionId:
          node.decision?.optionId,

        context:
          node.decision?.context,

        challenge:
          node.challenge,

        defense:
          node.decision?.defense,

        feedback:
          node.evaluation?.feedback,

        consequence:
          node.evaluation?.consequence,
      }),
    );

    this.finished =
      snapshot.phase === 'complete';

    this.summary = snapshot.summary;
    this.docContent = snapshot.docContent;
  }

  /**
   * Returns the current server-side phase.
   */
  get phase(): string | undefined {
    return undefined;
  }
}