import {
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';

import type {
  DecisionOption,
  Recommendation,
} from '../net/protocol';

export type UIScreen =
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

interface UIState {
  screen: UIScreen;

  modal: UIModal;

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
}

interface GameUIContextValue {
  state: UIState;

  setState: React.Dispatch<
    React.SetStateAction<UIState>
  >;
}

const GameUIContext =
  createContext<
    GameUIContextValue | undefined
  >(undefined);

const initialState: UIState = {
  screen: 'common',

  modal: null,

  options: [],
};

export function GameUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] =
    useState<UIState>(
      initialState,
    );

  const value = useMemo(
    () => ({
      state,
      setState,
    }),
    [state],
  );

  return (
    <GameUIContext.Provider
      value={value}
    >
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