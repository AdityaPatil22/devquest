import './HUD.css';

export function HUD() {
  return (
    <header className="hud">
      <div>
        <div className="hud-title">DEVQUEST</div>

        <div className="hud-subtitle">Engineering Decision Simulator</div>
      </div>

      <div className="hud-status">
        <span className="status-dot" />
        LIVE
      </div>
    </header>
  );
}
