import { GameUIProvider } from './state/GameUIContext';
import { PhaserGame } from './game/PhaserGame';
import { GameUI } from './components/GameUI';

export function App() {
  return (
    <GameUIProvider>
      <main className="devquest-app">
        <PhaserGame />

        <div id="react-ui" className="react-ui-layer">
          <GameUI />
        </div>
      </main>
    </GameUIProvider>
  );
}
