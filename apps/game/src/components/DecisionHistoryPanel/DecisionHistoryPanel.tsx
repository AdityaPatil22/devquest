import type { DecisionHistoryEntry } from '../../game/GameBridge';
import './DecisionHistoryPanel.css';

interface Props {
  decisionHistory: DecisionHistoryEntry[];
}

function getOptionLetter(id: string, index: number): string {
  const match = id.match(/([a-d])$/i);

  if (match) {
    return match[1].toUpperCase();
  }

  return String.fromCharCode(65 + index);
}

export function DecisionHistoryPanel({ decisionHistory }: Props) {
  const orderedHistory = [...decisionHistory].sort((a, b) => a.round - b.round);

  return (
    <aside className="decision-history-panel" aria-label="Decision history">
      <header className="decision-history-panel__header">
        <div>
          <div className="decision-history-panel__eyebrow">SESSION COMPLETE</div>
          <h2>DECISION HISTORY</h2>
        </div>
        <span className="decision-history-panel__count">{orderedHistory.length}</span>
      </header>
      <div className="decision-history-panel__body">
        {orderedHistory.length === 0 ? (
          <div className="decision-history-panel__empty">No decisions recorded.</div>
        ) : (
          orderedHistory.map((entry, index) => (
            <article key={entry.nodeId} className="decision-history-panel__entry">
              <div className="decision-history-panel__entry-top">
                <span className="decision-history-panel__index">{index + 1}</span>
                <span className="decision-history-panel__round">ROUND {entry.round}</span>
              </div>
              <div className="decision-history-panel__question">{entry.question}</div>
              <div className="decision-history-panel__choice">
                <span className="decision-history-panel__badge">
                  {getOptionLetter(entry.selectedOption.id, 0)}
                </span>
                <div className="decision-history-panel__choice-content">
                  <strong>{entry.selectedOption.label}</strong>
                  {entry.explanation && <p>{entry.explanation}</p>}
                </div>
              </div>
              {entry.recommendedOption && (
                <div className="decision-history-panel__recommendation">
                  Claude recommended {getOptionLetter(entry.recommendedOption, 0)}
                </div>
              )}
            </article>
          ))
        )}
      </div>
      <footer className="decision-history-panel__footer">
        <span className="decision-history-panel__footer-dot" />
        <span>Your selected path</span>
      </footer>
    </aside>
  );
}
