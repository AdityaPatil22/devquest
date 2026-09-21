interface Props {
  option?: DecisionOption;
  open: boolean;

  onSubmit: (
    context?: string,
  ) => void;
}

export function DoorContextModal({
  option,
  open,
  onSubmit,
}: Props) {
  const [context, setContext] =
    useState('');

  if (!open || !option) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section className="decision-modal">
        <span>
          DOOR {option.id}
        </span>

        <h2>
          {option.label}
        </h2>

        <p>
          Add context before
          entering?
        </p>

        <textarea
          value={context}
          onChange={(event) =>
            setContext(
              event.target.value,
            )
          }
          placeholder='"I was also thinking..."'
        />

        <div className="actions">
          <button
            onClick={() =>
              onSubmit()
            }
          >
            SKIP
          </button>

          <button
            onClick={() =>
              onSubmit(
                context.trim() ||
                  undefined,
              )
            }
          >
            ENTER DOOR
          </button>
        </div>
      </section>
    </div>
  );
}