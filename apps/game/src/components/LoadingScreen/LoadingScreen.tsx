import './LoadingScreen.css';

interface Props {
  progress: number;
}

export function LoadingScreen({
  progress,
}: Props) {
  const percentage = Math.round(
    Math.max(
      0,
      Math.min(1, progress),
    ) * 100,
  );

  return (
    <div className="loading-screen">
      <div className="loading-card">
        <div className="loading-eyebrow">
          DEVQUEST
        </div>

        <h1>
          Loading quest...
        </h1>

        <div className="loading-bar">
          <div
            className="loading-bar-progress"
            style={{
              width: `${percentage}%`,
            }}
          />
        </div>

        <div className="loading-percentage">
          {percentage}%
        </div>
      </div>
    </div>
  );
}