import './InteractionPrompt.css';

interface Props {
  visible: boolean;
  text: string;
}

export function InteractionPrompt({ visible, text }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <div className="interaction-prompt">
      <span className="interaction-key">E</span>

      {text}
    </div>
  );
}
