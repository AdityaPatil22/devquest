import { useEffect, useState } from 'react';

import type { DecisionHistoryEntry } from '../../game/GameBridge';

import './DecisionHistoryPanel.css';

interface Props {
  entries: DecisionHistoryEntry[];
  currentRound?: number;
  currentQuestion?: string;
  compact?: boolean;
}

export function DecisionHistoryPanel({
  entries,
  currentRound,
  currentQuestion,
  compact = false,
}: Props) {
  const [expandedNodeId, setExpandedNodeId] = useState<string>();

  useEffect(() => {
    const latest = entries[entries.length - 1];

    if (latest) {
      setExpandedNodeId(latest.nodeId);
    }
  }, [entries]);

  const orderedEntries = [...entries].reverse();

  return (
    <aside
      className={`decision-history-panel${
        compact ? ' decision-history-panel--compact' : ''
      }`}
      aria-label="Claude reasoning history"
    >
      <div className="decision-history-panel__header">
        <div className="decision-history-panel__eyebrow">
          AI REASONING
        </div>

        <h2>Claude</h2>

        <p>Your previous choices and Claude's reasoning.</p>
      </div>

      {currentQuestion && (
        <div className="decision-history-panel__current">
          <div className="decision-history-panel__current-label">
            NEXT DECISION
          </div>

          <div className="decision-history-panel__current-round">
            ROUND {currentRound}
          </div>

          <div className="decision-history-panel__current-question">
            {currentQuestion}
          </div>
        </div>
      )}

      <div className="decision-history-panel__list">
        {orderedEntries.length === 0 ? (
          <div className="decision-history-panel__empty">
            <strong>No previous decisions yet.</strong>

            <span>
              Choose a door and Claude's reasoning will appear here.
            </span>
          </div>
        ) : (
          orderedEntries.map((entry) => {
            const expanded = expandedNodeId === entry.nodeId;

            return (
              <article
                className={`decision-history-entry${
                  expanded ? ' decision-history-entry--expanded' : ''
                }`}
                key={entry.nodeId}
              >
                <button
                  type="button"
                  className="decision-history-entry__toggle"
                  onClick={() =>
                    setExpandedNodeId(
                      expanded ? undefined : entry.nodeId,
                    )
                  }
                >
                  <div>
                    <div className="decision-history-entry__round">
                      ROUND {entry.round}
                    </div>

                    <div className="decision-history-entry__summary">
                      <span>{entry.selectedOption.id}</span>

                      <strong>{entry.selectedOption.label}</strong>
                    </div>
                  </div>

                  <span className="decision-history-entry__chevron">
                    {expanded ? '−' : '+'}
                  </span>
                </button>

                {expanded && (
                  <div className="decision-history-entry__content">
                    <div className="decision-history-entry__label">
                      YOUR CHOICE
                    </div>

                    <div className="decision-history-entry__selected">
                      <span>{entry.selectedOption.id}</span>

                      <strong>
                        {entry.selectedOption.label}
                      </strong>
                    </div>

                    {entry.explanation && (
                      <>
                        <div className="decision-history-entry__label">
                          CLAUDE
                        </div>

                        <p className="decision-history-entry__explanation">
                          {entry.explanation}
                        </p>
                      </>
                    )}

                    {entry.recommendedOption && (
                      <>
                        <div className="decision-history-entry__label">
                          RECOMMENDATION
                        </div>

                        <div className="decision-history-entry__recommended">
                          {entry.recommendedOption}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
