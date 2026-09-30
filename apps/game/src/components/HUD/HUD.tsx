import './HUD.css';

interface Props {
  round?: number;
}

export function HUD({ round }: Props) {
  return (
    <header className="hud">
      <div>
        <div className="hud-title">DEVQUEST</div>

        <div className="hud-subtitle">Engineering Decision Simulator</div>
      </div>

      <div className="hud-right">
        {round !== undefined && <div className="hud-round">ROUND {round}</div>}

        <div className="hud-status">
          <span className="status-dot" />
          LIVE
        </div>
      </div>
    </header>
  );
}
