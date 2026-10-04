import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type Phaser from 'phaser';
import type { DecisionOption, Recommendation } from '../net/protocol';
import type { DecisionHistoryEntry } from '../game/GameBridge';

export type UIScreen = 'loading' | 'start' | 'decision' | 'complete';
export type UIModal = null | 'door-context' | 'waiting';

export interface UIState {
  screen: UIScreen;
  modal: UIModal;
  gameReady: boolean;
  loading: boolean;
  loadingProgress: number;
  doorNear: boolean;
  nearDoorOption?: DecisionOption;
  trophyNear: boolean;
  trophySummaryOpen: boolean;
  trophyProblem?: string;
  problem?: string;
  round?: number;
  question?: string;
  description?: string;
  options: DecisionOption[];
  recommendation?: Recommendation;
  selectedOption?: DecisionOption;
  decisionHistory: DecisionHistoryEntry[];
  aiThinking: boolean;
  aiThinkingMessage?: string;
  corridorProcessing: boolean;
  corridorProcessingStage: 'received' | 'processing' | 'ready';
  corridorProcessingMessage?: string;
  workstationNear: boolean;
  workstationType?: 'ai-workstation' | 'ai-terminal';
  workstationOpen: boolean;
  objective: string;
  waitingMessage?: string;
  summary?: string;
  docContent?: string;
  error?: string;
}

interface GameUIContextValue {
  state: UIState;
  game: Phaser.Game | null;

  setState: React.Dispatch<React.SetStateAction<UIState>>;

  setGame: (game: Phaser.Game | null) => void;
}

const initialState: UIState = {
  screen: 'loading',
  modal: null,

  gameReady: false,
  loading: true,
  loadingProgress: 0,

  doorNear: false,
  nearDoorOption: undefined,

  trophyNear: false,
  trophySummaryOpen: false,

  options: [],

  decisionHistory: [],

  aiThinking: false,
  aiThinkingMessage: undefined,

  objective: '',

  waitingMessage: undefined,

  error: undefined,

  corridorProcessing: false,
  corridorProcessingStage: 'processing',
  corridorProcessingMessage: undefined,
  workstationNear: false,
  workstationType: undefined,
  workstationOpen: false,
};

const GameUIContext = createContext<GameUIContextValue | undefined>(undefined);

export function GameUIProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UIState>(initialState);

  const [game, setGameState] = useState<Phaser.Game | null>(null);

  const setGame = useCallback((nextGame: Phaser.Game | null) => {
    setGameState(nextGame);
  }, []);

  const value = useMemo(
    () => ({
      state,
      game,
      setState,
      setGame,
    }),
    [state, game, setGame],
  );

  return <GameUIContext.Provider value={value}>{children}</GameUIContext.Provider>;
}

export function useGameUI() {
  const context = useContext(GameUIContext);

  if (!context) {
    throw new Error('useGameUI must be used inside GameUIProvider');
  }

  return context;
}
