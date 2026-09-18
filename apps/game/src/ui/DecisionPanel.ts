import Phaser from 'phaser';
import { Panel } from './Panel';
import { TextButton } from './TextButton';
import { COLORS } from '../config';

export interface DecisionOption {
  id: string;
  label: string;
}

export interface DecisionPanelConfig {
  x: number;
  y: number;
  question: string;
  options: DecisionOption[];
  onSelect: (optionId: string) => void;
}

export class DecisionPanel extends Panel {
  private buttons: TextButton[] = [];

  constructor(scene: Phaser.Scene, config: DecisionPanelConfig) {
    const panelHeight = 160 + config.options.length * 44;
    super(scene, {
      x: config.x,
      y: config.y,
      width: 600,
      height: panelHeight,
    });

    // Title
    this.addText(0, -panelHeight / 2 + 20, '⚡ ENGINEERING DECISION', {
      fontSize: '10px',
      color: COLORS.textHighlight,
    });

    // Question text
    this.addText(0, -panelHeight / 2 + 52, config.question, {
      fontSize: '10px',
      color: COLORS.textPrimary,
      wordWrap: { width: 540 },
    });

    // Option buttons
    const startY = -panelHeight / 2 + 120;
    config.options.forEach((option, index) => {
      const btn = new TextButton(scene, {
        x: 0,
        y: startY + index * 44,
        text: option.label,
        width: 400,
        height: 36,
        onClick: () => config.onSelect(option.id),
      });
      this.container.add(btn.container);
      this.buttons.push(btn);
    });
  }

  destroy(): void {
    this.buttons.forEach((b) => b.destroy());
    super.destroy();
  }
}
