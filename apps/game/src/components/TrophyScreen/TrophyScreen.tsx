import {
  useState,
} from 'react';

import './TrophyScreen.css';

interface Props {
  summary?: string;
  docContent?: string;
}

export function TrophyScreen({
  summary,
  docContent,
}: Props) {
  const [showDocument, setShowDocument] =
    useState(false);

  return (
    <div className="trophy-screen">
      <section className="trophy-card">
        <div className="trophy-icon">
          ★
        </div>

        <div className="modal-eyebrow">
          QUEST COMPLETE
        </div>

        <h1>
          Decision defended.
        </h1>

        {summary && (
          <p className="trophy-summary">
            {summary}
          </p>
        )}

        <div className="trophy-actions">
          <button
            type="button"
            onClick={() =>
              setShowDocument(
                (value) => !value,
              )
            }
          >
            {showDocument
              ? 'HIDE DOCUMENT'
              : 'VIEW DOCUMENT'}
          </button>
        </div>

        {showDocument &&
          docContent && (
            <article className="trophy-document">
              <pre>
                {docContent}
              </pre>
            </article>
          )}
      </section>
    </div>
  );
}