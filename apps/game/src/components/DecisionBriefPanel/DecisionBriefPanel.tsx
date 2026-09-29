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
    compact?: boolean;
  }
  
  export function DecisionBriefPanel({
    question,
    description,
    options,
    recommendation,
    compact = false,
  }: Props) {
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
  
    return (
      <aside
        className={`decision-brief-panel${
          compact
            ? ' decision-brief-panel--compact'
            : ''
        }`}
        aria-label="Current decision"
      >
        <div className="decision-brief-panel__eyebrow">
          CURRENT DECISION
        </div>
  
        <h2>{question}</h2>
  
        {description && (
          <p className="decision-brief-panel__description">
            {description}
          </p>
        )}
  
        {recommendation && (
          <section className="decision-brief-panel__recommendation">
            <div className="decision-brief-panel__section-label">
              CLAUDE'S VIEW
            </div>
  
            {recommendedOption && (
              <div className="decision-brief-panel__recommended-option">
                <span>
                  {recommendedOption.id}
                </span>
  
                <strong>
                  {recommendedOption.label}
                </strong>
              </div>
            )}
  
            <p>
              {recommendation.why}
            </p>
  
            {recommendation.whatToKnow && (
              <>
                <div className="decision-brief-panel__section-label">
                  WHAT TO KNOW
                </div>
  
                <p>
                  {recommendation.whatToKnow}
                </p>
              </>
            )}
          </section>
        )}
  
        <section>
          <div className="decision-brief-panel__section-label">
            OPTIONS
          </div>
  
          <div className="decision-brief-panel__options">
            {options.map((option) => (
              <div
                className="decision-brief-panel__option"
                key={option.id}
              >
                <div className="decision-brief-panel__option-header">
                  <span>
                    {option.id}
                  </span>
  
                  <strong>
                    {option.label}
                  </strong>
                </div>
  
                {option.description && (
                  <p>
                    {option.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </aside>
    );
  }