// ─────────────────────────────────────────────
// Client → Server Messages
// ─────────────────────────────────────────────

export interface StartSessionMsg { type: 'START_SESSION'; }
export interface SubmitProblemMsg { type: 'PROBLEM_SUBMITTED'; problem: string; }
export interface OptionSelectedMsg { type: 'OPTION_SELECTED'; nodeId: string; optionId: string; context?: string; }
export interface ChallengeResponseMsg { type: 'CHALLENGE_RESPONSE'; nodeId: string; response: string; }
export interface ReconsiderMsg { type: 'RECONSIDER'; nodeId: string; }
export interface ContinueMsg { type: 'CONTINUE'; }
export type ClientMessage = StartSessionMsg | SubmitProblemMsg | OptionSelectedMsg | ChallengeResponseMsg | ReconsiderMsg | ContinueMsg;

export interface DecisionOption { id: string; label: string; }
export interface Recommendation { option: string; why: string; }
export interface DecisionSnapshot {
  id: string; question: string; options: DecisionOption[]; recommendation?: Recommendation; round: number;
  parentId?: string; dependsOn?: string; status: string;
  decision?: { optionId: string; context?: string; defense?: string; };
  challenge?: string;
  evaluation?: { feedback: string; consequence: string; };
}
export interface PlayerSnapshot {
  position: { x: number; y: number };
  currentRoomId?: string;
  completedRooms: string[];
}
export interface WorldRoomSnapshot {
  id: string;
  mapKey: string;
  kind: 'common' | 'decision' | 'corridor' | 'random' | 'trophy';
  variant?: string;
  order: number;
  generatedAt: number;
  metadata?: Record<string, string | number | boolean>;
}
export interface WorldSnapshot {
  rooms: WorldRoomSnapshot[];
  currentRoomId?: string;
  progressionIndex: number;
}
export interface SessionSnapshot {
  sessionId: string; problem?: string; phase: string; round: number; currentNodeId?: string;
  decisions: DecisionSnapshot[]; world?: WorldSnapshot; player?: PlayerSnapshot;
  summary?: string; docContent?: string;
}

export interface SessionStartedMsg { type: 'SESSION_STARTED'; sessionId: string; }
export interface SessionResumedMsg {
  type: 'SESSION_RESUMED'; sessionId: string; phase: string; round: number; snapshot: SessionSnapshot;
}
export interface DecisionCreatedMsg {
  type: 'DECISION_CREATED'; nodeId: string; question: string; options: DecisionOption[];
  recommendation?: Recommendation; round: number; dependsOn?: string;
}
export interface ChallengeMsg { type: 'CHALLENGE'; nodeId: string; question: string; }
export interface EvaluationMsg { type: 'EVALUATION'; nodeId: string; feedback: string; consequence: string; }
export interface SessionCompleteMsg {
  type: 'SESSION_COMPLETE'; summary: string; decisionsCount: number; reconsideredCount: number; docContent: string;
}
export interface ErrorMsg { type: 'ERROR'; message: string; }
export type ServerMessage = SessionStartedMsg | SessionResumedMsg | DecisionCreatedMsg | ChallengeMsg | EvaluationMsg | SessionCompleteMsg | ErrorMsg;