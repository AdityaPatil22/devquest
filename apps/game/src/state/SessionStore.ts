import type { DecisionOption } from '../net/protocol';

export interface DecisionRecord {
  nodeId: string;
  areaId: string;
  question: string;
  options: DecisionOption[];
  selectedOptionId?: string;
  reasoning?: string;
  feedback?: string;
  consequence?: string;
}

/**
 * Client-side store of the current session state.
 * The server is the source of truth — this is a local mirror.
 */
export class SessionStore {
  sessionId?: string;
  decisions: Map<string, DecisionRecord> = new Map();
  completedAreas: Set<string> = new Set();

  setSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.decisions.clear();
    this.completedAreas.clear();
  }

  addDecision(record: DecisionRecord): void {
    this.decisions.set(record.nodeId, record);
  }

  updateDecision(nodeId: string, update: Partial<DecisionRecord>): void {
    const existing = this.decisions.get(nodeId);
    if (existing) {
      Object.assign(existing, update);
    }
  }

  markAreaCompleted(areaId: string): void {
    this.completedAreas.add(areaId);
  }

  isAreaCompleted(areaId: string): boolean {
    return this.completedAreas.has(areaId);
  }
}
