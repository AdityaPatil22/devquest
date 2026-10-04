import { useEffect } from 'react';
import './AIWorkstation.css';

interface Props {
  open: boolean;
  type?: 'ai-workstation' | 'ai-terminal';
  stage: 'received' | 'processing' | 'ready';
  message?: string;
  onClose: () => void;
}

export function AIWorkstation({ open, type = 'ai-workstation', stage, message, onClose }: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const status = stage === 'ready' ? 'READY' : stage === 'received' ? 'RECEIVED' : 'PROCESSING';
  const title = type === 'ai-terminal' ? 'Decision Terminal' : 'AI Workstation';

  return (
    <div className="ai-workstation">
      <div className="ai-workstation__window">
        <div className="ai-workstation__header">
          <div>
            <div className="ai-workstation__eyebrow">DEVQUEST // {title.toUpperCase()}</div>
            <h2>{type === 'ai-terminal' ? 'Decision Archive' : 'Claude Processing'}</h2>
          </div>
          <button type="button" className="ai-workstation__close" onClick={onClose}>
            CLOSE
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
            <div className={`ai-workstation__bar-fill ai-workstation__bar-fill--${stage}`} />
          </div>
        </div>
        <div className="ai-workstation__footer">
          <span>{stage === 'ready' ? 'NEXT DECISION AVAILABLE' : 'NEXT DECISION IS BEING PREPARED'}</span>
          <span>ESC TO CLOSE</span>
        </div>
      </div>
    </div>
  );
}
