import './AIWorkstation.css';

interface Props {
  open: boolean;
  stage: 'received' | 'processing' | 'ready';
  message?: string;
  onClose: () => void;
}

export function AIWorkstation({
  open,
  stage,
  message,
  onClose,
}: Props) {
  if (!open) {
    return null;
  }

  const status =
    stage === 'ready'
      ? 'READY'
      : stage === 'received'
        ? 'RECEIVED'
        : 'PROCESSING';

  return (
    <div className="ai-workstation">
      <div className="ai-workstation__window">
        <div className="ai-workstation__header">
          <div>
            <div className="ai-workstation__eyebrow">
              DEVQUEST // AI WORKSTATION
            </div>
            <h2>Claude Processing</h2>
          </div>

          <button
            type="button"
            className="ai-workstation__close"
            onClick={onClose}
          >
            ESC
          </button>
        </div>

        <div className="ai-workstation__terminal">
          <div>&gt; SESSION CONNECTED</div>
          <div>&gt; REQUEST RECEIVED</div>
          <div>&gt; SELECTED OPTION ACCEPTED</div>
          <div>&gt; {message || 'Processing selected option...'}</div>
          <div>&gt; STATUS: {status}</div>
        </div>

        <div className="ai-workstation__status">
          <span>{status}</span>

          <div className="ai-workstation__bar">
            <div
              className={`ai-workstation__bar-fill ai-workstation__bar-fill--${stage}`}
            />
          </div>
        </div>

        <div className="ai-workstation__footer">
          <span>EXIT REMAINS LOCKED UNTIL NEXT DECISION IS READY</span>
        </div>
      </div>
    </div>
  );
}