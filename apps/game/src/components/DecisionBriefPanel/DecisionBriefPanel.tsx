import { useState } from 'react';

import type { DecisionHistoryEntry } from '../../game/GameBridge';
import type { DecisionOption, Recommendation } from '../../net/protocol';

import './DecisionBriefPanel.css';

interface Props {
  question?: string;
  description?: string;
  options: DecisionOption[];
  recommendation?: Recommendation;
  round?: number;
  decisionHistory: DecisionHistoryEntry[];
  aiThinking?: boolean;
  aiThinkingMessage?: string;
}

function getOptionLetter(id: string, index: number): string {
  const match = id.match(/([a-d])$/i);

  if (match) {
    return match[1].toUpperCase();
  }

  return String.fromCharCode(65 + index);
}

export function DecisionBriefPanel({
  question,
  description,
  options,
  recommendation,
  round,
  decisionHistory,
  aiThinking = false,
  aiThinkingMessage,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);

  if (!question) {
    return null;
  }

  const recommendedOption = recommendation
    ? options.find((option) => option.id === recommendation.option)
    : undefined;

  const recommendedIndex = recommendedOption
    ? options.findIndex((option) => option.id === recommendedOption.id)
    : -1;

  const latestReasoning =
    decisionHistory.length > 0 ? decisionHistory[decisionHistory.length - 1] : undefined;

  const orderedHistory = [...decisionHistory].reverse();

  return (
    <aside className="decision-brief-panel" aria-label="Decision information">
      {/* ─────────────────────────────
          Fixed panel header
          ───────────────────────────── */}

      <header className="decision-brief-panel__header">
        <div className="decision-brief-panel__header-main">
          <div className="decision-brief-panel__eyebrow">CURRENT DECISION</div>

          <div className="decision-brief-panel__header-meta">
            {round !== undefined && (
              <span className="decision-brief-panel__round">ROUND {round}</span>
            )}

            <span className="decision-brief-panel__live">
              <span className="decision-brief-panel__live-dot" />
              LIVE
            </span>
          </div>
        </div>

        {aiThinking && (
          <div className="decision-brief-panel__thinking" aria-live="polite">
            <span className="decision-brief-panel__thinking-dot" />

            <span>THINKING</span>
          </div>
        )}
      </header>

      {/* ─────────────────────────────
          Scrollable panel body
          ───────────────────────────── */}

      <div className="decision-brief-panel__body">
        <section className="decision-brief-panel__question">
          <h2>{question}</h2>

          {description && <p className="decision-brief-panel__description">{description}</p>}
        </section>

        {aiThinking && (
          <div className="decision-brief-panel__thinking-message" aria-live="polite">
            <span className="decision-brief-panel__thinking-icon">●</span>

            <div>
              <strong>Claude is thinking</strong>

              <span>{aiThinkingMessage ?? 'Preparing the next decision...'}</span>
            </div>
          </div>
        )}

        {/* ─────────────────────────
            Recommendation
            ───────────────────────── */}

        {recommendation && (
          <section className="decision-brief-panel__section">
            <div className="decision-brief-panel__section-heading">
              <span>CLAUDE&apos;S RECOMMENDATION</span>
            </div>

            <div className="decision-brief-panel__recommendation">
              <div className="decision-brief-panel__recommendation-header">
                <span className="decision-brief-panel__option-badge decision-brief-panel__option-badge--large">
                  {recommendedOption
                    ? getOptionLetter(recommendedOption.id, recommendedIndex)
                    : getOptionLetter(recommendation.option, 0)}
                </span>

                <div className="decision-brief-panel__recommendation-title">
                  <strong>{recommendedOption?.label ?? recommendation.option}</strong>

                  <span>RECOMMENDED PATH</span>
                </div>
              </div>

              <p className="decision-brief-panel__recommendation-reason">{recommendation.why}</p>

              {recommendation.whatToKnow && (
                <div className="decision-brief-panel__what-to-know">
                  <div className="decision-brief-panel__inline-label">WHAT COULD CHANGE THIS</div>

                  <p>{recommendation.whatToKnow}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─────────────────────────
            Options
            ───────────────────────── */}

        <section className="decision-brief-panel__section">
          <div className="decision-brief-panel__section-heading-row">
            <div className="decision-brief-panel__section-heading">
              <span>OPTIONS</span>
            </div>

            <span className="decision-brief-panel__section-count">{options.length}</span>
          </div>

          <div className="decision-brief-panel__options" aria-label="Available options">
            {options.map((option, index) => {
              const isRecommended = recommendation?.option === option.id;

              return (
                <article
                  key={option.id}
                  className={[
                    'decision-brief-panel__option',
                    isRecommended ? 'decision-brief-panel__option--recommended' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="decision-brief-panel__option-header">
                    <span className="decision-brief-panel__option-badge">
                      {getOptionLetter(option.id, index)}
                    </span>

                    <strong>{option.label}</strong>
                  </div>

                  {option.description && <p>{option.description}</p>}

                  {isRecommended && (
                    <span className="decision-brief-panel__recommended-label">RECOMMENDED</span>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* ─────────────────────────
            Latest reasoning
            ───────────────────────── */}

        {latestReasoning && (
          <section className="decision-brief-panel__section">
            <div className="decision-brief-panel__section-heading">
              <span>LATEST REASONING</span>
            </div>

            <div className="decision-brief-panel__reasoning">
              <div className="decision-brief-panel__reasoning-header">
                <div className="decision-brief-panel__reasoning-round">
                  ROUND {latestReasoning.round}
                </div>

                <span className="decision-brief-panel__reasoning-badge">
                  {getOptionLetter(latestReasoning.selectedOption.id, 0)}
                </span>

                <strong>{latestReasoning.selectedOption.label}</strong>
              </div>

              {latestReasoning.explanation && <p>{latestReasoning.explanation}</p>}

              {latestReasoning.recommendedOption && (
                <div className="decision-brief-panel__reasoning-footer">
                  <span>CLAUDE RECOMMENDED</span>

                  <strong>{getOptionLetter(latestReasoning.recommendedOption, 0)}</strong>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─────────────────────────
            History
            ───────────────────────── */}

        {orderedHistory.length > 0 && (
          <details
            className="decision-brief-panel__history"
            open={historyOpen}
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
          >
            <summary className="decision-brief-panel__history-summary">
              <div>
                <span>DECISION HISTORY</span>

                <small>Previous choices</small>
              </div>

              <span className="decision-brief-panel__history-summary-right">
                <span className="decision-brief-panel__history-count">{orderedHistory.length}</span>

                <span className="decision-brief-panel__history-chevron">
                  {historyOpen ? '−' : '+'}
                </span>
              </span>
            </summary>

            <div className="decision-brief-panel__history-list">
              {orderedHistory.map((entry, index) => (
                <article key={entry.nodeId} className="decision-brief-panel__history-entry">
                  <div className="decision-brief-panel__history-entry-top">
                    <span className="decision-brief-panel__history-index">
                      {orderedHistory.length - index}
                    </span>

                    <span className="decision-brief-panel__history-round">ROUND {entry.round}</span>
                  </div>

                  <div className="decision-brief-panel__history-choice">
                    <span className="decision-brief-panel__history-badge">
                      {getOptionLetter(entry.selectedOption.id, 0)}
                    </span>

                    <strong>{entry.selectedOption.label}</strong>
                  </div>

                  {entry.explanation && <p>{entry.explanation}</p>}
                </article>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ─────────────────────────────
          Fixed footer
          ───────────────────────────── */}

      <footer className="decision-brief-panel__footer">
        <span className="decision-brief-panel__footer-dot" />

        <span>Scroll for more</span>
      </footer>
    </aside>
  );
}
