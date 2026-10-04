import { useEffect, useState } from 'react';

import './ProblemInput.css';

interface Props {
  open: boolean;
  waiting: boolean;
  message?: string;
  error?: string;
  onSubmit: (problem: string) => void;
}

export function ProblemInput({
  open,
  waiting,
  message,
  error,
  onSubmit,
}: Props) {
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!open) {
      setProblem('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="problem-input-backdrop">
      <section className="problem-input">
        <div className="problem-input__eyebrow">
          DEVQUEST
        </div>

        <h1>What do you want to be grilled on?</h1>

        <p>
          Describe the engineering decision you want DevQuest
          to challenge.
        </p>

        {waiting ? (
          <div className="problem-input__waiting">
            <div className="problem-input__spinner" />

            <span>
              {message || 'Generating your first decision...'}
            </span>
          </div>
        ) : (
          <>
            <textarea
              value={problem}
              onChange={(event) =>
                setProblem(event.target.value)
              }
              placeholder='e.g. "Should I rewrite the auth service in Go?"'
              autoFocus
            />

            {error && (
              <div className="problem-input__error">
                {error}
              </div>
            )}

            <div className="problem-input__actions">
              <button
                type="button"
                disabled={!problem.trim()}
                onClick={() => {
                  const trimmed = problem.trim();

                  if (!trimmed) {
                    return;
                  }

                  onSubmit(trimmed);
                }}
              >
                START GRILLING
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}