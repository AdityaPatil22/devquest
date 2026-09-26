import './AIThinkingIndicator.css';

interface Props {
  visible: boolean;
  message?: string;
}

export function AIThinkingIndicator({ visible, message }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div className="ai-thinking-indicator">
      <div className="ai-thinking-indicator__dot" />

      <div>
        <div className="ai-thinking-indicator__title">
          CLAUDE IS THINKING
        </div>

        <div className="ai-thinking-indicator__message">
          {message ?? 'Preparing the next decision...'}
        </div>
      </div>
    </div>
  );
}
