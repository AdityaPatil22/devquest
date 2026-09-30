import { useState } from 'react';

import type { DecisionHistoryEntry } from '../../game/GameBridge';
import type {
  DecisionOption,
  Recommendation,
} from '../../net/protocol';

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

function getOptionLetter(
  id: string,
  index: number,
): string {
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
  const [historyOpen, setHistoryOpen] =
    useState(false);

  if (!question) {
    return null;
  }

  const recommendedOption =
    recommendation
      ? options.find(
          (option) =>
            option.id ===
            recommendation.option,
        )
      : undefined;

  const latestReasoning =
    decisionHistory.length > 0
      ? decisionHistory[
          decisionHistory.length - 1
        ]
      : undefined;

  const orderedHistory = [
    ...decisionHistory,
  ].reverse();

  const recommendedIndex =
    recommendedOption
      ? options.findIndex(
          (option) =>
            option.id ===
            recommendedOption.id,
        )
      : -1;

  return (
    <aside
      className="decision-brief-panel"
      aria-label="Current decision"
    >
      <div className="decision-brief-panel__header">
        <div>
          <div className="decision-brief-panel__eyebrow">
            CURRENT DECISION
          </div>

          {round !== undefined && (
            <div className="decision-brief-panel__round">
              ROUND {round}
            </div>
          )}
        </div>

        {aiThinking && (
          <div className="decision-brief-panel__thinking">
            <span className="decision-brief-panel__thinking-dot" />
            THINKING
          </div>
        )}
      </div>

      <h2>{question}</h2>

      {description && (
        <p className="decision-brief-panel__description">
          {description}
        </p>
      )}

      {aiThinking && (
        <div className="decision-brief-panel__thinking-message">
          <span className="decision-brief-panel__thinking-icon">
            ●
          </span>

          <span>
            {aiThinkingMessage ??
              'Preparing the next decision...'}
          </span>
        </div>
      )}

      {recommendation && (
        <section className="decision-brief-panel__section">
          <div className="decision-brief-panel__section-heading">
            CLAUDE'S RECOMMENDATION
          </div>

          <div className="decision-brief-panel__recommendation">
            <div className="decision-brief-panel__recommendation-header">
              <span className="decision-brief-panel__option-badge">
                {recommendedOption
                  ? getOptionLetter(
                      recommendedOption.id,
                      recommendedIndex,
                    )
                  : getOptionLetter(
                      recommendation.option,
                      0,
                    )}
              </span>

              <strong>
                {recommendedOption?.label ??
                  recommendation.option}
              </strong>
            </div>

            <p>{recommendation.why}</p>

            {recommendation.whatToKnow && (
              <div className="decision-brief-panel__what-to-know">
                <div className="decision-brief-panel__inline-label">
                  WHAT COULD CHANGE THIS
                </div>

                <p>
                  {recommendation.whatToKnow}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="decision-brief-panel__section">
        <div className="decision-brief-panel__section-heading-row">
          <div className="decision-brief-panel__section-heading">
            OPTIONS
          </div>

          <span className="decision-brief-panel__section-count">
            {options.length}
          </span>
        </div>

        <div className="decision-brief-panel__options">
          {options.map((option, index) => {
            const isRecommended =
              recommendation?.option ===
              option.id;

            return (
              <div
                key={option.id}
                className={`decision-brief-panel__option${
                  isRecommended
                    ? ' decision-brief-panel__option--recommended'
                    : ''
                }`}
              >
                <div className="decision-brief-panel__option-header">
                  <span className="decision-brief-panel__option-badge">
                    {getOptionLetter(
                      option.id,
                      index,
                    )}
                  </span>

                  <strong>
                    {option.label}
                  </strong>
                </div>

                {option.description && (
                  <p>{option.description}</p>
                )}

                {isRecommended && (
                  <span className="decision-brief-panel__recommended-label">
                    RECOMMENDED
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {latestReasoning && (
        <section className="decision-brief-panel__section">
          <div className="decision-brief-panel__section-heading">
            LATEST REASONING
          </div>

          <div className="decision-brief-panel__reasoning">
            <div className="decision-brief-panel__reasoning-header">
              <span>
                ROUND {latestReasoning.round}
              </span>

              <span className="decision-brief-panel__reasoning-badge">
                {getOptionLetter(
                  latestReasoning
                    .selectedOption.id,
                  0,
                )}
              </span>

              <strong>
                {
                  latestReasoning
                    .selectedOption.label
                }
              </strong>
            </div>

            {latestReasoning.explanation && (
              <p>
                {latestReasoning.explanation}
              </p>
            )}

            {latestReasoning.recommendedOption && (
              <div className="decision-brief-panel__reasoning-footer">
                <span>
                  CLAUDE RECOMMENDED
                </span>

                <strong>
                  {getOptionLetter(
                    latestReasoning.recommendedOption,
                    0,
                  )}
                </strong>
              </div>
            )}
          </div>
        </section>
      )}

      {orderedHistory.length > 0 && (
        <details
          className="decision-brief-panel__history"
          open={historyOpen}
          onToggle={(event) =>
            setHistoryOpen(
              event.currentTarget.open,
            )
          }
        >
          <summary>
            <span>DECISION HISTORY</span>

            <span className="decision-brief-panel__history-count">
              {orderedHistory.length}
            </span>
          </summary>

          <div className="decision-brief-panel__history-list">
            {orderedHistory.map(
              (entry) => (
                <article
                  key={entry.nodeId}
                  className="decision-brief-panel__history-entry"
                >
                  <div className="decision-brief-panel__history-entry-header">
                    <span>
                      ROUND {entry.round}
                    </span>

                    <div>
                      <span className="decision-brief-panel__history-badge">
                        {getOptionLetter(
                          entry
                            .selectedOption.id,
                          0,
                        )}
                      </span>

                      <strong>
                        {
                          entry
                            .selectedOption
                            .label
                        }
                      </strong>
                    </div>
                  </div>

                  {entry.explanation && (
                    <p>
                      {entry.explanation}
                    </p>
                  )}
                </article>
              ),
            )}
          </div>
        </details>
      )}
    </aside>
  );
}