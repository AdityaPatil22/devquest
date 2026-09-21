import { useState } from 'react';

import './ElevatorModal.css';

interface Props {
  open: boolean;
  waiting: boolean;
  onSubmit: (
    problem: string,
  ) => void;
}

export function ElevatorModal({
  open,
  waiting,
  onSubmit,
}: Props) {
  const [problem, setProblem] =
    useState('');

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section className="elevator-modal">
        <div className="eyebrow">
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
          <div className="waiting">
            Generating your decision...
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
              placeholder='e.g. "Should I rewrite the auth service in Go?"'
            />

            <button
              disabled={!problem.trim()}
              onClick={() =>
                onSubmit(
                  problem.trim(),
                )
              }
            >
              ENTER THE ELEVATOR
            </button>
          </>
        )}
      </section>
    </div>
  );
}