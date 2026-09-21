import { GameUIProvider, useGameUI } from './state/GameUIContext';
import { PhaserGame } from './game/PhaserGame';
import { GameUI } from './components/GameUI';
import { DevToolbar } from './dev/DevToolbar';

function AppContent() {
  const { game } = useGameUI();

  return (
    <main className="devquest-app">
      <PhaserGame />

      <div id="react-ui" className="react-ui-layer">
        <GameUI />
      </div>

      <DevToolbar game={game} />
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
