import {
  useEffect,
  useState,
} from 'react';

import type {
  DecisionOption,
} from '../../net/protocol';

import './DoorContextModal.css';

interface Props {
  option?: DecisionOption;

  open: boolean;

  onSubmit: (
    context?: string,
  ) => void;

  onCancel: () => void;
}

export function DoorContextModal({
  option,
  open,
  onSubmit,
  onCancel,
}: Props) {
  const [context, setContext] =
    useState('');

  useEffect(() => {
    if (open) {
      setContext('');
    }
  }, [open, option?.id]);

  if (!open || !option) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section className="decision-modal">
        <div className="modal-eyebrow">
          DOOR {option.id}
        </div>

        <h2>
          {option.label}
        </h2>

        <p>
          Add context before
          entering this decision?
        </p>

        <textarea
          value={context}
          onChange={(event) =>
            setContext(
              event.target.value,
            )
          }
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          placeholder={
            '"I was also thinking..."'
          }
          autoFocus
        />

        <div className="actions">
          <button
            type="button"
            onClick={() => {
              onCancel();
            }}
          >
            BACK
          </button>

          <button
            type="button"
            onClick={() => {
              onSubmit(
                context.trim() ||
                  undefined,
              );
            }}
          >
            ENTER DOOR
          </button>
        </div>
      </section>
    </div>
  );
}