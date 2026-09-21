import './WaitingOverlay.css';

interface Props {
  open: boolean;
  message?: string;
}

export function WaitingOverlay({ open, message }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="waiting-overlay">
      <div className="waiting-card">
        <div className="spinner" />

        <div className="waiting-title">PLEASE WAIT</div>

        <div className="waiting-message">{message || 'Waiting...'}</div>
      </div>
    </div>
  );
}
