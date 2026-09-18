import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { InteractionZone } from '../entities/InteractionZone';
import { GamePhase } from '../state/GameState';
import { GAME_WIDTH, GAME_HEIGHT, TILE_SIZE } from '../config';

/** Area definitions for the software office */
interface AreaDef {
  id: string;
  label: string;
  x: number;
  y: number;
  color: number;
}

const AREAS: AreaDef[] = [
  { id: 'api-lab', label: 'API Lab', x: 160, y: 128, color: 0x44aaff },
  { id: 'database-lab', label: 'Database Lab', x: 480, y: 128, color: 0x44ff88 },
  { id: 'security-lab', label: 'Security', x: 160, y: 384, color: 0xff4444 },
  { id: 'deployment', label: 'Deployment', x: 480, y: 384, color: 0xffaa44 },
];

export class OfficeScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactionZones: InteractionZone[] = [];
  private interactKey!: Phaser.Input.Keyboard.Key;
  private phase: GamePhase = GamePhase.EXPLORING;
  private promptText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  create(): void {
    this.buildOffice();
    this.createPlayer();
    this.createInteractionZones();
    this.setupInput();

    // Launch the UI scene in parallel (overlay)
    this.scene.launch('UIScene');

    // Listen for phase changes from UIScene
    const uiScene = this.scene.get('UIScene');
    uiScene.events.on('phase-changed', (newPhase: GamePhase) => {
      this.phase = newPhase;
    });
  }

  update(): void {
    if (this.phase === GamePhase.EXPLORING) {
      this.player.handleMovement(this.cursors);
      this.checkInteractionProximity();
    } else {
      this.player.stop();
    }
  }

  /** Draw the office floor and walls using placeholder tiles */
  private buildOffice(): void {
    const cols = Math.ceil(GAME_WIDTH / TILE_SIZE);
    const rows = Math.ceil(GAME_HEIGHT / TILE_SIZE);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const isWall =
          y === 0 || y === rows - 1 || x === 0 || x === cols - 1;

        this.add
          .image(x * TILE_SIZE + 8, y * TILE_SIZE + 8, isWall ? 'wall' : 'floor')
          .setDepth(0);
      }
    }

    // Title
    this.add
      .text(GAME_WIDTH / 2, 24, 'SOFTWARE OFFICE', {
        fontFamily: '"Press Start 2P"',
        fontSize: '12px',
        color: '#4a9eff',
      })
      .setOrigin(0.5)
      .setDepth(10);
  }

  /** Create the player entity */
  private createPlayer(): void {
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }

  /** Create interactable areas in the office */
  private createInteractionZones(): void {
    for (const area of AREAS) {
      const zone = new InteractionZone(this, area.x, area.y, area.id, area.label, area.color);
      this.interactionZones.push(zone);

      this.physics.add.overlap(this.player.sprite, zone.zone, () => {
        zone.setPlayerInside(true);
      });
    }
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  /** Show/hide "Press E" prompt when near an interaction zone */
  private checkInteractionProximity(): void {
    let nearestZone: InteractionZone | null = null;
    let minDist = Infinity;

    for (const zone of this.interactionZones) {
      const dist = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        zone.x,
        zone.y
      );

      zone.setPlayerInside(dist < 48);

      if (dist < 48 && dist < minDist) {
        minDist = dist;
        nearestZone = zone;
      }
    }

    if (nearestZone) {
      this.showPrompt(nearestZone);

      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.handleInteraction(nearestZone);
      }
    } else {
      this.hidePrompt();
    }
  }

  private showPrompt(zone: InteractionZone): void {
    if (!this.promptText) {
      this.promptText = this.add
        .text(0, 0, '', {
          fontFamily: '"Press Start 2P"',
          fontSize: '8px',
          color: '#ffaa44',
          backgroundColor: '#1a1a2e',
          padding: { x: 4, y: 4 },
        })
        .setDepth(100);
    }

    this.promptText.setText(`Press E: ${zone.label}`);
    this.promptText.setPosition(
      zone.x - this.promptText.width / 2,
      zone.y - 40
    );
    this.promptText.setVisible(true);
  }

  private hidePrompt(): void {
    this.promptText?.setVisible(false);
  }

  /** Trigger interaction with an area */
  private handleInteraction(zone: InteractionZone): void {
    this.phase = GamePhase.SHOWING_DECISION;
    this.hidePrompt();

    // Notify the UI scene to show the decision panel
    const uiScene = this.scene.get('UIScene');
    uiScene.events.emit('area-entered', { areaId: zone.areaId, label: zone.label });
  }
}
