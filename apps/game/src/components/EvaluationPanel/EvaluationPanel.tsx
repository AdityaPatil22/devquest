import './EvaluationPanel.css';

interface Props {
  open: boolean;

  feedback?: string;

  consequence?: string;
}

export function EvaluationPanel({ open, feedback, consequence }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section className="evaluation-panel">
        <div className="modal-eyebrow">EVALUATION</div>

        <h2>Decision evaluated</h2>

        <div className="evaluation-block">
          <div className="evaluation-label">FEEDBACK</div>

          <p>{feedback || 'No feedback available.'}</p>
        </div>

        <div className="evaluation-block">
          <div className="evaluation-label">CONSEQUENCE</div>

          <p>{consequence || 'No consequence available.'}</p>
        </div>

        <div className="evaluation-hint">The next decision will appear automatically...</div>
      </section>
    </div>
  );
}
