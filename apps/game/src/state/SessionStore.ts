import { DecisionState } from './DecisionState';
import { PlayerState } from './PlayerState';
import { WorldState } from './WorldState';

import type { DecisionOption, Recommendation, SessionSnapshot } from '../net/protocol';

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
  readonly world = new WorldState();
  readonly player = new PlayerState();
  readonly decision = new DecisionState();

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
    this.world.reset();
    this.player.reset();
    this.decision.reset();
  }

  setSession(sessionId: string): void { this.sessionId = sessionId; }
  setProblem(problem: string): void { this.problem = problem; }

  registerRoom(room: import('./WorldState').GeneratedRoomState): void {
    this.world.registerRoom(room);
  }

  setPlayerPosition(x: number, y: number): void {
    this.player.setPosition(x, y);
  }

  setPlayerRoom(roomId: string | undefined): void {
    this.player.setRoom(roomId);
    this.world.setCurrentRoom(roomId);
  }

  get worldState() { return this.world.snapshot(); }
  get playerState() { return this.player.snapshot(); }
  get decisionState() { return this.decision.snapshot(); }

  addDecision(record: DecisionRecord): void {
    const existing = this.decisions.find((decision) => decision.nodeId === record.nodeId);
    if (existing) {
      Object.assign(existing, { ...record, options: [...record.options] });
    } else {
      this.decisions.push({ ...record, options: [...record.options] });
    }

    this.currentNodeId = record.nodeId;
    this.totalRounds = Math.max(this.totalRounds, record.round);

    this.decision.setDecision({
      nodeId: record.nodeId,
      question: record.question,
      options: record.options,
      recommendation: record.recommendation,
      round: record.round,
    });
  }

  getCurrentDecision(): DecisionRecord | undefined {
    return this.decisions.find((decision) => decision.nodeId === this.currentNodeId);
  }

  updateCurrent(update: Partial<DecisionRecord>): void {
    const current = this.getCurrentDecision();
    if (!current) return;

    Object.assign(current, update);

    if (update.selectedOptionId !== undefined || update.context !== undefined) {
      this.decision.selectOption(current.selectedOptionId ?? '', current.context);
    }
    if (update.challenge !== undefined) this.decision.setChallenge(update.challenge);
    if (update.defense !== undefined) this.decision.setDefense(update.defense);
    if (update.feedback !== undefined || update.consequence !== undefined) {
      this.decision.setEvaluation(current.feedback ?? '', current.consequence ?? '');
    }
  }

  complete(summary: string, docContent: string): void {
    this.finished = true;
    this.summary = summary;
    this.docContent = docContent;
  }

  hydrate(snapshot: SessionSnapshot): void {
    this.sessionId = snapshot.sessionId;
    this.problem = snapshot.problem;
    this.currentNodeId = snapshot.currentNodeId;
    this.totalRounds = snapshot.round;

    this.decisions = snapshot.decisions.map((node): DecisionRecord => ({
      nodeId: node.id,
      question: node.question,
      options: node.options.map((option) => ({ ...option })),
      recommendation: node.recommendation ? { ...node.recommendation } : undefined,
      round: node.round,
      selectedOptionId: node.decision?.optionId,
      context: node.decision?.context,
      challenge: node.challenge,
      defense: node.decision?.defense,
      feedback: node.evaluation?.feedback,
      consequence: node.evaluation?.consequence,
    }));

    this.world.hydrate(snapshot.world);
    this.player.hydrate(snapshot.player);
    this.finished = snapshot.phase === 'complete';
    this.summary = snapshot.summary;
    this.docContent = snapshot.docContent;

    this.decision.reset();
    const current = this.getCurrentDecision();
    if (!current) return;

    this.decision.setDecision({
      nodeId: current.nodeId,
      question: current.question,
      options: current.options,
      recommendation: current.recommendation,
      round: current.round,
    });

    if (current.selectedOptionId) this.decision.selectOption(current.selectedOptionId, current.context);
    if (current.challenge) this.decision.setChallenge(current.challenge);
    if (current.defense) this.decision.setDefense(current.defense);
    if (current.feedback || current.consequence) {
      this.decision.setEvaluation(current.feedback ?? '', current.consequence ?? '');
    }
  }

  get phase(): string | undefined {
    return this.finished ? 'complete' : undefined;
  }
}
