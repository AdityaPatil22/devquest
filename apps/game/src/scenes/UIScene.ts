import Phaser from 'phaser';
import { GamePhase } from '../state/GameState';
import { DecisionPanel } from '../ui/DecisionPanel';
import { ReasoningPanel } from '../ui/ReasoningPanel';
import { EvaluationPanel } from '../ui/EvaluationPanel';
import { GameTextInput } from '../ui/GameTextInput';
import { WebSocketClient } from '../net/WebSocketClient';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { ServerMessage, DecisionCreatedMsg, ChallengeMsg, EvaluationMsg } from '../net/protocol';

/**
 * UIScene runs as an overlay on top of OfficeScene.
 * It manages all UI panels and communicates with the backend.
 */
export class UIScene extends Phaser.Scene {
  private ws!: WebSocketClient;
  private textInput!: GameTextInput;
  private decisionPanel?: DecisionPanel;
  private reasoningPanel?: ReasoningPanel;
  private evaluationPanel?: EvaluationPanel;
  private loadingText?: Phaser.GameObjects.Text;
  private currentNodeId?: string;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.ws = new WebSocketClient();
    this.ws.onMessage(this.handleServerMessage.bind(this));
    this.ws.connect();

    this.textInput = new GameTextInput(
      this.game.canvas.parentElement as HTMLElement
    );

    // Listen for area-entered from OfficeScene
    this.events.on('area-entered', (data: { areaId: string; label: string }) => {
      this.onAreaEntered(data.areaId, data.label);
    });
  }

  /** Player entered an interaction zone */
  private onAreaEntered(areaId: string, label: string): void {
    this.showLoading(`Entering ${label}...`);

    this.ws.send({
      type: 'ENTER_AREA',
      areaId,
    });
  }

  /** Handle messages from the backend */
  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'DECISION_CREATED':
        this.hideLoading();
        this.showDecision(msg as DecisionCreatedMsg);
        break;

      case 'REASONING_REQUESTED':
        this.hideLoading();
        this.showReasoning(msg.nodeId, msg.prompt);
        break;

      case 'CHALLENGE':
        this.hideLoading();
        this.showChallenge(msg as ChallengeMsg);
        break;

      case 'EVALUATION':
        this.hideLoading();
        this.showEvaluation(msg as EvaluationMsg);
        break;

      case 'ERROR':
        this.hideLoading();
        console.error('Server error:', msg.message);
        this.setPhase(GamePhase.EXPLORING);
        break;
    }
  }

  /** Display the decision panel with options */
  private showDecision(msg: DecisionCreatedMsg): void {
    this.clearPanels();
    this.currentNodeId = msg.nodeId;

    this.decisionPanel = new DecisionPanel(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      question: msg.question,
      options: msg.options,
      onSelect: (optionId: string) => {
        this.decisionPanel?.destroy();
        this.decisionPanel = undefined;
        this.showLoading('Processing...');

        this.ws.send({
          type: 'SELECT_OPTION',
          nodeId: this.currentNodeId!,
          optionId,
        });
      },
    });

    this.setPhase(GamePhase.SHOWING_DECISION);
  }

  /** Display the reasoning input panel */
  private showReasoning(nodeId: string, prompt: string): void {
    this.clearPanels();
    this.currentNodeId = nodeId;

    this.reasoningPanel = new ReasoningPanel(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      prompt,
      textInput: this.textInput,
      canvas: this.game.canvas,
      onSubmit: (text: string) => {
        this.reasoningPanel?.destroy();
        this.reasoningPanel = undefined;
        this.showLoading('AI is thinking...');

        this.ws.send({
          type: 'SUBMIT_REASONING',
          nodeId: this.currentNodeId!,
          text,
        });
      },
    });

    this.setPhase(GamePhase.AWAITING_REASONING);
  }

  /** Display the AI challenge */
  private showChallenge(msg: ChallengeMsg): void {
    this.clearPanels();

    this.reasoningPanel = new ReasoningPanel(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      prompt: msg.question,
      textInput: this.textInput,
      canvas: this.game.canvas,
      onSubmit: (text: string) => {
        this.reasoningPanel?.destroy();
        this.reasoningPanel = undefined;
        this.showLoading('AI is evaluating...');

        this.ws.send({
          type: 'RESPOND_TO_CHALLENGE',
          nodeId: this.currentNodeId!,
          text,
        });
      },
    });

    this.setPhase(GamePhase.SHOWING_CHALLENGE);
  }

  /** Display the evaluation result */
  private showEvaluation(msg: EvaluationMsg): void {
    this.clearPanels();

    this.evaluationPanel = new EvaluationPanel(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      feedback: msg.feedback,
      consequence: msg.consequence,
      onContinue: () => {
        this.evaluationPanel?.destroy();
        this.evaluationPanel = undefined;
        this.ws.send({ type: 'CONTINUE' });
        this.setPhase(GamePhase.EXPLORING);
      },
      onReconsider: () => {
        this.evaluationPanel?.destroy();
        this.evaluationPanel = undefined;
        this.showLoading('Loading decision...');
        this.ws.send({ type: 'RECONSIDER', nodeId: this.currentNodeId! });
      },
    });

    this.setPhase(GamePhase.SHOWING_EVALUATION);
  }

  private showLoading(message: string): void {
    this.hideLoading();
    this.loadingText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, {
        fontFamily: '"Press Start 2P"',
        fontSize: '10px',
        color: '#4a9eff',
      })
      .setOrigin(0.5)
      .setDepth(200);

    // Pulsing animation
    this.tweens.add({
      targets: this.loadingText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    this.setPhase(GamePhase.WAITING_FOR_AI);
  }

  private hideLoading(): void {
    if (this.loadingText) {
      this.tweens.killTweensOf(this.loadingText);
      this.loadingText.destroy();
      this.loadingText = undefined;
    }
  }

  private clearPanels(): void {
    this.decisionPanel?.destroy();
    this.decisionPanel = undefined;
    this.reasoningPanel?.destroy();
    this.reasoningPanel = undefined;
    this.evaluationPanel?.destroy();
    this.evaluationPanel = undefined;
    this.textInput.hide();
  }

  private setPhase(phase: GamePhase): void {
    this.events.emit('phase-changed', phase);
  }
}
