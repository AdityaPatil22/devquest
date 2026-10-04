import { GameUIProvider, useGameUI } from './state/GameUIContext';
import { PhaserGame } from './game/PhaserGame';
import { GameUI } from './components/GameUI';
import { DevToolbar } from './dev/DevToolbar';

function AppContent() {
  const { game, state } = useGameUI();

  const showDevToolbar =
    import.meta.env.DEV &&
    import.meta.env.VITE_SHOW_DEV_TOOLBAR === 'true';

  return (
    <main
      className={`devquest-app ${
        state.screen === 'start'
          ? 'devquest-app--boot'
          : 'devquest-app--game'
      }`}
    >
      <PhaserGame />

      <div
        id="react-ui"
        className="react-ui-layer"
      >
        <GameUI />
      </div>

      {showDevToolbar && (
        <DevToolbar game={game} />
      )}
    </main>
  );
}

export function App() {
  return (
    <GameUIProvider>
      <AppContent />
    </GameUIProvider>
  );
}
