import Phaser from 'phaser';
import { Panel } from './Panel';
import { TextButton } from './TextButton';
import { GameTextInput } from './GameTextInput';
import { COLORS } from '../config';

export interface ReasoningPanelConfig {
  x: number;
  y: number;
  prompt: string;
  textInput: GameTextInput;
  canvas: HTMLCanvasElement;
  onSubmit: (text: string) => void;
}

export class ReasoningPanel extends Panel {
  private textInput: GameTextInput;
  private submitBtn: TextButton;

  constructor(scene: Phaser.Scene, config: ReasoningPanelConfig) {
    super(scene, { x: config.x, y: config.y, width: 600, height: 320 });
    this.textInput = config.textInput;

    // Title
    this.addText(0, -130, '🤖 AI CHALLENGE', {
      fontSize: '10px',
      color: COLORS.textWarning,
    });

    // Prompt text
    this.addText(0, -96, config.prompt, {
      fontSize: '10px',
      color: COLORS.textPrimary,
      wordWrap: { width: 540 },
    });

    // Position the HTML textarea inside the panel
    const canvasRect = config.canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / scene.cameras.main.width;
    const scaleY = canvasRect.height / scene.cameras.main.height;

    const textareaWidth = 520;
    const textareaHeight = 100;
    const textareaX = canvasRect.left + (config.x - textareaWidth / 2) * scaleX;
    const textareaY = canvasRect.top + (config.y - 30) * scaleY;

    this.textInput.show(
      textareaX,
      textareaY,
      textareaWidth * scaleX,
      textareaHeight * scaleY,
      'Explain your reasoning...'
    );

    // Submit button
    this.submitBtn = new TextButton(scene, {
      x: 0,
      y: 110,
      text: 'SUBMIT',
      width: 160,
      height: 36,
      onClick: () => {
        const text = this.textInput.getValue();
        if (text.trim().length > 0) {
          config.onSubmit(text.trim());
        }
      },
    });
    this.container.add(this.submitBtn.container);
  }

  destroy(): void {
    this.textInput.hide();
    this.submitBtn.destroy();
    super.destroy();
  }
}
