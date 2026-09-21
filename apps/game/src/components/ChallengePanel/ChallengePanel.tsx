import {
  useEffect,
  useState,
} from 'react';

import './ChallengePanel.css';

interface Props {
  open: boolean;

  question?: string;

  onSubmit: (
    defense: string,
  ) => void;
}

export function ChallengePanel({
  open,
  question,
  onSubmit,
}: Props) {
  const [defense, setDefense] =
    useState('');

  useEffect(() => {
    if (!open) {
      setDefense('');
    }
  }, [open, question]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section className="challenge-panel">
        <div className="modal-eyebrow">
          THE GRILL
        </div>

        <h2>
          Defend your decision
        </h2>

        <div className="challenge-question">
          {question}
        </div>

        <textarea
          value={defense}
          onChange={(event) =>
            setDefense(
              event.target.value,
            )
          }
          placeholder="Explain why you would make this choice..."
          autoFocus
        />

        <div className="actions">
          <button
            type="button"
            disabled={!defense.trim()}
            onClick={() =>
              onSubmit(
                defense.trim(),
              )
            }
          >
            DEFEND MY CHOICE
          </button>
        </div>
      </section>
    </div>
  );
}