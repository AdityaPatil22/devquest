import {
  useEffect,
  useState,
} from 'react';

import './ElevatorModal.css';

interface Props {
  open: boolean;
  waiting: boolean;

  error?: string;

  onSubmit: (
    problem: string,
  ) => void;

  onClose: () => void;
}

export function ElevatorModal({
  open,
  waiting,
  error,
  onSubmit,
  onClose,
}: Props) {
  const [problem, setProblem] =
    useState('');

  useEffect(() => {
    if (!open) {
      setProblem('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section className="elevator-modal">
        <div className="modal-eyebrow">
          THE ELEVATOR
        </div>

        <h1>
          What do you want to
          be grilled on?
        </h1>

        <p>
          Describe the engineering
          decision you want DevQuest
          to challenge.
        </p>

        {waiting ? (
          <div className="modal-waiting">
            <div className="spinner" />

            <span>
              Generating your
              decision...
            </span>
          </div>
        ) : (
          <>
            <textarea
              value={problem}
              onChange={(event) =>
                setProblem(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              placeholder={
                'e.g. "Should I rewrite the auth service in Go?"'
              }
              autoFocus
            />

            {error && (
              <div className="modal-error">
                {error}
              </div>
            )}

            <div className="actions">
              <button
                type="button"
                onClick={onClose}
              >
                CANCEL
              </button>

              <button
                type="button"
                disabled={
                  !problem.trim()
                }
                onClick={() => {
                  onSubmit(
                    problem.trim(),
                  );
                }}
              >
                ENTER THE ELEVATOR
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}