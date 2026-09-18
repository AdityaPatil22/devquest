// ─── Client → Server Messages ───

export interface EnterAreaMsg {
  type: 'ENTER_AREA';
  areaId: string;
}

export interface SelectOptionMsg {
  type: 'SELECT_OPTION';
  nodeId: string;
  optionId: string;
}

export interface SubmitReasoningMsg {
  type: 'SUBMIT_REASONING';
  nodeId: string;
  text: string;
}

export interface RespondToChallengeMsg {
  type: 'RESPOND_TO_CHALLENGE';
  nodeId: string;
  text: string;
}

export interface ReconsiderMsg {
  type: 'RECONSIDER';
  nodeId: string;
}

export interface ContinueMsg {
  type: 'CONTINUE';
}

export interface StartSessionMsg {
  type: 'START_SESSION';
  project?: string;
}

export interface RequestHistoryMsg {
  type: 'REQUEST_HISTORY';
}

export type ClientMessage =
  | EnterAreaMsg
  | SelectOptionMsg
  | SubmitReasoningMsg
  | RespondToChallengeMsg
  | ReconsiderMsg
  | ContinueMsg
  | StartSessionMsg
  | RequestHistoryMsg;

// ─── Server → Client Messages ───

export interface DecisionOption {
  id: string;
  label: string;
}

export interface SessionStartedMsg {
  type: 'SESSION_STARTED';
  sessionId: string;
}

export interface DecisionCreatedMsg {
  type: 'DECISION_CREATED';
  nodeId: string;
  question: string;
  options: DecisionOption[];
  context?: string;
}

export interface ReasoningRequestedMsg {
  type: 'REASONING_REQUESTED';
  nodeId: string;
  prompt: string;
}

export interface ChallengeMsg {
  type: 'CHALLENGE';
  nodeId: string;
  question: string;
}

export interface EvaluationMsg {
  type: 'EVALUATION';
  nodeId: string;
  feedback: string;
  consequence: string;
  nextAction: 'CONTINUE' | 'MORE_QUESTIONS';
}

export interface AreaCompletedMsg {
  type: 'AREA_COMPLETED';
  areaId: string;
}

export interface SessionCompleteMsg {
  type: 'SESSION_COMPLETE';
  summary: Record<string, unknown>;
}

export interface ErrorMsg {
  type: 'ERROR';
  message: string;
}

export type ServerMessage =
  | SessionStartedMsg
  | DecisionCreatedMsg
  | ReasoningRequestedMsg
  | ChallengeMsg
  | EvaluationMsg
  | AreaCompletedMsg
  | SessionCompleteMsg
  | ErrorMsg;
