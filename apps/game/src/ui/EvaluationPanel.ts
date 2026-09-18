import Phaser from 'phaser';
import { Panel } from './Panel';
import { TextButton } from './TextButton';
import { COLORS } from '../config';

export interface EvaluationPanelConfig {
  x: number;
  y: number;
  feedback: string;
  consequence: string;
  onContinue: () => void;
  onReconsider: () => void;
}

export class EvaluationPanel extends Panel {
  private continueBtn: TextButton;
  private reconsiderBtn: TextButton;

  constructor(scene: Phaser.Scene, config: EvaluationPanelConfig) {
    super(scene, { x: config.x, y: config.y, width: 600, height: 360 });

    // Title
    this.addText(0, -152, '📋 EVALUATION', {
      fontSize: '10px',
      color: COLORS.textHighlight,
    });

    // Feedback
    this.addText(0, -118, 'Feedback:', {
      fontSize: '8px',
      color: COLORS.textSecondary,
    });
    this.addText(0, -96, config.feedback, {
      fontSize: '10px',
      color: COLORS.textPrimary,
      wordWrap: { width: 540 },
    });

    // Consequence
    this.addText(0, 0, 'Consequence:', {
      fontSize: '8px',
      color: COLORS.textSecondary,
    });
    this.addText(0, 22, config.consequence, {
      fontSize: '10px',
      color: COLORS.textWarning,
      wordWrap: { width: 540 },
    });

    // Buttons
    this.continueBtn = new TextButton(scene, {
      x: -100,
      y: 130,
      text: 'CONTINUE',
      width: 180,
      height: 36,
      onClick: config.onContinue,
    });
    this.container.add(this.continueBtn.container);

    this.reconsiderBtn = new TextButton(scene, {
      x: 100,
      y: 130,
      text: 'RECONSIDER',
      width: 180,
      height: 36,
      onClick: config.onReconsider,
    });
    this.container.add(this.reconsiderBtn.container);
  }

  destroy(): void {
    this.continueBtn.destroy();
    this.reconsiderBtn.destroy();
    super.destroy();
  }
}
