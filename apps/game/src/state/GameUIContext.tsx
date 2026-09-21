import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type Phaser from 'phaser';

import type {
  DecisionOption,
  Recommendation,
} from '../net/protocol';

export type UIScreen =
  | 'loading'
  | 'common'
  | 'decision'
  | 'complete';

export type UIModal =
  | null
  | 'elevator'
  | 'door-context'
  | 'challenge'
  | 'evaluation'
  | 'waiting';

export interface UIState {
  screen: UIScreen;
  modal: UIModal;

  gameReady: boolean;
  loading: boolean;
  loadingProgress: number;

  elevatorNear: boolean;
  elevatorWaiting: boolean;

  doorNear: boolean;
  nearDoorOption?: DecisionOption;

  problem?: string;

  round?: number;
  question?: string;
  options: DecisionOption[];
  recommendation?: Recommendation;

  selectedOption?: DecisionOption;

  challenge?: string;

  feedback?: string;
  consequence?: string;

  waitingMessage?: string;

  summary?: string;
  docContent?: string;

  error?: string;
}

interface GameUIContextValue {
  state: UIState;
  game: Phaser.Game | null;

  setState: React.Dispatch<
    React.SetStateAction<UIState>
  >;

  setGame: (game: Phaser.Game | null) => void;
}

const initialState: UIState = {
  screen: 'loading',
  modal: null,

  gameReady: false,
  loading: true,
  loadingProgress: 0,

  elevatorNear: false,
  elevatorWaiting: false,

  doorNear: false,
  nearDoorOption: undefined,

  options: [],
};

const GameUIContext =
  createContext<GameUIContextValue | undefined>(
    undefined,
  );

export function GameUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] =
    useState<UIState>(initialState);

  const [game, setGameState] =
    useState<Phaser.Game | null>(null);

  const setGame = useCallback(
    (nextGame: Phaser.Game | null) => {
      setGameState(nextGame);
    },
    [],
  );

  const value = useMemo(
    () => ({
      state,
      game,
      setState,
      setGame,
    }),
    [state, game, setGame],
  );

  return (
    <GameUIContext.Provider value={value}>
      {children}
    </GameUIContext.Provider>
  );
}

export function useGameUI() {
  const context =
    useContext(GameUIContext);

  if (!context) {
    throw new Error(
      'useGameUI must be used inside GameUIProvider',
    );
  }

  return context;
}