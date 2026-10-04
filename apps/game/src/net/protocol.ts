// ─────────────────────────────────────────────
// Client → Server Messages
// ─────────────────────────────────────────────

export interface StartSessionMsg {
  type: 'START_SESSION';
}

export interface SubmitProblemMsg {
  type: 'PROBLEM_SUBMITTED';
  problem: string;
}

export interface OptionSelectedMsg {
  type: 'OPTION_SELECTED';
  nodeId: string;
  optionId: string;
  context?: string;
}

export type ClientMessage = StartSessionMsg | SubmitProblemMsg | OptionSelectedMsg;

// ─────────────────────────────────────────────
// Decision types
// ─────────────────────────────────────────────

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
}

export interface Recommendation {
  option: string;
  why: string;
  whatToKnow?: string;
}

export interface DecisionSnapshot {
  id: string;
  question: string;
  description: string;
  options: DecisionOption[];
  recommendation?: Recommendation;
  round: number;
  parentId?: string;
  dependsOn?: string;
  status: string;

  decision?: {
    optionId: string;
    context?: string;
  };
}

// ─────────────────────────────────────────────
// Complete server-side session snapshot
// ─────────────────────────────────────────────

export interface SessionSnapshot {
  sessionId: string;
  problem?: string;
  phase: string;
  round: number;
  currentNodeId?: string;

  decisions: DecisionSnapshot[];

  summary?: string;
  docContent?: string;
}

// ─────────────────────────────────────────────
// Server → Client Messages
// ─────────────────────────────────────────────

export interface SessionStartedMsg {
  type: 'SESSION_STARTED';
  sessionId: string;
}

export interface SessionResumedMsg {
  type: 'SESSION_RESUMED';
  sessionId: string;
  phase: string;
  round: number;
  snapshot: SessionSnapshot;
}

export interface DecisionCreatedMsg {
  type: 'DECISION_CREATED';
  nodeId: string;
  question: string;
  description: string;
  options: DecisionOption[];
  recommendation?: Recommendation;
  round: number;
  dependsOn?: string;
}

export interface SessionCompleteMsg {
  type: 'SESSION_COMPLETE';
  summary: string;
  decisionsCount: number;
  docContent: string;
}

export interface ErrorMsg {
  type: 'ERROR';
  message: string;
}

export interface CorridorStatusMsg {
  type: 'CORRIDOR_STATUS';
  status: 'processing' | 'ready';
}

export type ServerMessage =
  | SessionStartedMsg
  | SessionResumedMsg
  | DecisionCreatedMsg
  | SessionCompleteMsg
  | CorridorStatusMsg
  | ErrorMsg;