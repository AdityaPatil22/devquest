import './TrophySummary.css';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  problem?: string;
  summary?: string;
  docContent?: string;
  onClose: () => void;
}

export function TrophySummary({ open, problem, summary, docContent, onClose }: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const downloadDocument = () => {
    if (!docContent) {
      return;
    }

    const blob = new Blob([docContent], {
      type: 'text/markdown;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'devquest-implementation-plan.md';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="trophy-summary-backdrop">
      <div className="trophy-summary">
        <div className="trophy-summary-header">
          <h1>INVESTIGATION</h1>

          <div className="trophy-summary-header__actions">
            {docContent && (
              <button className="trophy-summary-download" onClick={downloadDocument}>
                DOWNLOAD PLAN
              </button>
            )}

            <button className="trophy-summary-close" onClick={onClose} aria-label="Close summary">
              ×
            </button>
          </div>
        </div>

        {docContent && (
          <section className="trophy-summary-section">
            <h2>DECISION DOCUMENT</h2>

            <pre>{docContent}</pre>
          </section>
        )}

        <div className="trophy-summary-footer">
          Press <strong>ESC</strong> to close
        </div>
      </div>
    </div>
  );
}