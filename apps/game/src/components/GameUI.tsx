import { useEffect } from 'react';

import { useGameUI } from '../state/GameUIContext';

import { HUD } from './HUD/HUD';
import { InteractionPrompt } from './InteractionPrompt/InteractionPrompt';

export function GameUI() {
  const { setState } =
    useGameUI();

  useEffect(() => {
    const game =
      window.devQuestGame;

    if (!game) {
      return;
    }

    const handler = (
      event: any,
    ) => {
      if (
        event.type ===
        'ELEVATOR_NEAR'
      ) {
        setState(
          (previous) => ({
            ...previous,

            modal:
              previous.modal,

            // store this separately in
            // a later refinement
          }),
        );
      }
    };

    game.events.on(
      'devquest:ui',
      handler,
    );

    return () => {
      game.events.off(
        'devquest:ui',
        handler,
      );
    };
  }, [setState]);

  return (
    <>
      <HUD />
    </>
  );
}