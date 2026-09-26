import type { DecisionHistoryEntry } from '../../game/GameBridge';

import './DecisionHistoryPanel.css';

interface Props {
  entries: DecisionHistoryEntry[];
}

export function DecisionHistoryPanel({ entries }: Props) {
  return (
    <aside className="decision-history-panel" aria-label="Claude reasoning history">
      <div className="decision-history-panel__header">
        <div className="decision-history-panel__eyebrow">AI REASONING</div>
        <h2>Claude</h2>
        <p>Previous choices and the reasoning behind the next decision.</p>
      </div>

      <div className="decision-history-panel__list">
        {entries.length === 0 ? (
          <div className="decision-history-panel__empty">
            <strong>Choose a door to begin.</strong>
            <span>Claude's explanation will appear here and remain visible as you continue.</span>
          </div>
        ) : (
          entries.map((entry) => (
            <article className="decision-history-entry" key={entry.nodeId}>
              <div className="decision-history-entry__round">ROUND {entry.round}</div>

              <div className="decision-history-entry__question">{entry.question}</div>

              <div className="decision-history-entry__label">SELECTED</div>

              <div className="decision-history-entry__selected">
                <span>{entry.selectedOption.id}</span>
                <strong>{entry.selectedOption.label}</strong>
              </div>

              {entry.recommendedOption && (
                <>
                  <div className="decision-history-entry__label">CLAUDE RECOMMENDED</div>
                  <div className="decision-history-entry__recommended">
                    {entry.recommendedOption}
                  </div>
                </>
              )}

              {entry.explanation && (
                <div className="decision-history-entry__label">EXPLANATION</div>
              )}

              {entry.explanation && (
                <p className="decision-history-entry__explanation">{entry.explanation}</p>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
