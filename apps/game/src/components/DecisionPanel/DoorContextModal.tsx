import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type { DecisionOption } from '../../net/protocol';

import './DoorContextModal.css';

interface Props {
  option?: DecisionOption;
  open: boolean;
  onSubmit: (context?: string) => void;
  onCancel: () => void;
}

function getOptionLetter(
  option: DecisionOption,
): string {
  const match =
    option.id.match(/([a-d])$/i);

  return (
    match?.[1]?.toUpperCase() ??
    option.id.charAt(0).toUpperCase()
  );
}

export function DoorContextModal({
  option,
  open,
  onSubmit,
  onCancel,
}: Props) {
  const [context, setContext] =
    useState('');

  const textareaRef =
    useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setContext('');
      return;
    }

    setContext('');

    const timeout = window.setTimeout(
      () => {
        textareaRef.current?.focus();
      },
      0,
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open, option?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        event.preventDefault();

        onCancel();

        return;
      }

      if (
        event.key === 'Enter' &&
        (event.metaKey ||
          event.ctrlKey)
      ) {
        event.preventDefault();

        onSubmit(
          context.trim() || undefined,
        );
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    open,
    context,
    onCancel,
    onSubmit,
  ]);

  if (!open || !option) {
    return null;
  }

  const optionLetter =
    getOptionLetter(option);

  const handleSubmit = () => {
    onSubmit(
      context.trim() || undefined,
    );
  };

  return (
    <section
      className="door-context-panel"
      aria-label={`Door ${optionLetter} confirmation`}
    >
      <div className="door-context-panel__accent" />

      <header className="door-context-panel__header">
        <div className="door-context-panel__header-main">
          <div className="door-context-panel__eyebrow">
            DOOR CHECKPOINT
          </div>

          <div className="door-context-panel__meta">
            <span className="door-context-panel__door-badge">
              {optionLetter}
            </span>

            <span className="door-context-panel__door-label">
              {option.label}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="door-context-panel__close"
          aria-label="Go back"
          onClick={onCancel}
        >
          ×
        </button>
      </header>

      {option.description && (
        <p className="door-context-panel__description">
          {option.description}
        </p>
      )}

      <div className="door-context-panel__divider" />

      <label
        className="door-context-panel__label"
        htmlFor="door-context-input"
      >
        ADD CONTEXT
      </label>

      <p className="door-context-panel__prompt">
        Anything else Claude should
        consider before you commit to
        this path?
      </p>

      <textarea
        ref={textareaRef}
        id="door-context-input"
        value={context}
        onChange={(event) =>
          setContext(
            event.target.value,
          )
        }
        placeholder="I was also thinking..."
        rows={4}
      />

      <div className="door-context-panel__footer">
        <div className="door-context-panel__hint">
          <span>ESC</span>
          <span>BACK</span>

          <span>⌘ / CTRL + ENTER</span>
          <span>CONFIRM</span>
        </div>

        <div className="door-context-panel__actions">
          <button
            type="button"
            className="door-context-panel__back"
            onClick={onCancel}
          >
            BACK
          </button>

          <button
            type="button"
            className="door-context-panel__enter"
            onClick={handleSubmit}
          >
            <span>▶</span>

            ENTER DOOR
          </button>
        </div>
      </div>
    </section>
  );
}