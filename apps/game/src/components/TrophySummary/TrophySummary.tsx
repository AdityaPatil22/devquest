import './TrophySummary.css';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  problem?: string;
  summary?: string;
  docContent?: string;
  onClose: () => void;
}

export function TrophySummary({
  open,
  problem,
  summary,
  docContent,
  onClose,
}: Props) {
  if (!open) {
    return null;
  }
  useEffect(() => {
  if (!open) {
    return;
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  window.addEventListener(
    'keydown',
    handleKeyDown,
  );

  return () => {
    window.removeEventListener(
      'keydown',
      handleKeyDown,
    );
  };
}, [open, onClose]);

  return (
    <div className="trophy-summary-backdrop">
      <div className="trophy-summary">
        <div className="trophy-summary-header">
          <h1>SESSION SUMMARY</h1>

          <button
            className="trophy-summary-close"
            onClick={onClose}
            aria-label="Close summary"
          >
            ×
          </button>
        </div>

        {problem && (
          <section className="trophy-summary-section">
            <h2>PROBLEM</h2>
            <p>{problem}</p>
          </section>
        )}

        {summary && (
          <section className="trophy-summary-section">
            <h2>SUMMARY</h2>
            <p>{summary}</p>
          </section>
        )}

        {docContent && (
          <section className="trophy-summary-section">
            <h2>DECISION DOCUMENT</h2>

            <pre>{docContent}</pre>
          </section>
        )}

        <div className="trophy-summary-footer">
          Press <strong>E</strong> or <strong>ESC</strong> to close
        </div>
      </div>
    </div>
  );
}