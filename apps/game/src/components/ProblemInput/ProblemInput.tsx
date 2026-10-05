import { useEffect, useState } from 'react';

import './ProblemInput.css';

interface Props {
  waiting: boolean;
  message?: string;
  error?: string;
  onSubmit: (problem: string) => void;
}

export function ProblemInput({ waiting, message, error, onSubmit }: Props) {
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (waiting) {
      return;
    }

    if (error) {
      return;
    }
  }, [waiting, error]);

  const handleSubmit = () => {
    const trimmed = problem.trim();

    if (!trimmed || waiting) {
      return;
    }

    onSubmit(trimmed);
  };

  return (
    <section className="problem-input">
      <div className="problem-input__eyebrow">START A SESSION</div>

      <h2>What is the engineering problem you want to solve?</h2>

      <p className="problem-input__description">
        Describe the engineering decision you want DevQuest to challenge/grill you on
      </p>

      {waiting ? (
        <div className="problem-input__waiting">
          <div className="problem-input__spinner" />

          <div>
            <div className="problem-input__waiting-title">Generating your first decision</div>

            <div className="problem-input__waiting-message">
              {message || 'Claude is preparing your first question...'}
            </div>
          </div>
        </div>
      ) : (
        <>
          <textarea
            id="devquest-problem"
            value={problem}
            onChange={(event) => setProblem(event.target.value)}
            placeholder="e.g. Should I rewrite the auth service in Go?"
            rows={8}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();

                handleSubmit();
              }
            }}
          />

          {error && <div className="problem-input__error">{error}</div>}

          <div className="problem-input__footer">
            <span className="problem-input__shortcut">⌘ / Ctrl + Enter</span>

            <button type="button" disabled={!problem.trim()} onClick={handleSubmit}>
              <span>▶</span>
              START GRILLING
            </button>
          </div>
        </>
      )}
    </section>
  );
}
