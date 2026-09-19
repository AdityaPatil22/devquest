import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, FONTS } from '../config';
import { PATTERNS_KEY, PATTERNS, TILE_SCALE, DISPLAY_TILE } from '../tiles';

const COLS = Math.floor(GAME_WIDTH / DISPLAY_TILE);   // 32
const ROWS = Math.floor(GAME_HEIGHT / DISPLAY_TILE);  // 24

export class CommonRoomScene extends Phaser.Scene {
  private player!: Player;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private promptText?: Phaser.GameObjects.Text;
  private nearGate = false;
  private gateX = 0;
  private gateY = 0;

  constructor() {
    super({ key: 'CommonRoomScene' });
  }

  create(): void {
    this.walls = this.physics.add.staticGroup();
    this.buildRoom();
    this.createUI();
    this.createPlayer();
    this.physics.add.collider(this.player.sprite, this.walls);
    this.setupInput();
  }

  update(): void {
    this.player.handleMovement(this.cursors);
    this.checkGateProximity();
  }

  private buildRoom(): void {
    const FLOOR = [
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
      "####################",
    ];
    
    // Warm wood floor
    for (let y = 0; y < FLOOR.length; y++) {
      for (let x = 0; x < FLOOR[y].length; x++) {
    
        if (FLOOR[y][x] !== "#") continue;
    
        const frame =
          (x + y) % 2 === 0
            ? PATTERNS.COMMON_FLOOR
            : PATTERNS.COMMON_FLOOR_ALT;
    
        this.add.image(
          x * DISPLAY_TILE + DISPLAY_TILE / 2,
          y * DISPLAY_TILE + DISPLAY_TILE / 2,
          PATTERNS_KEY,
          frame
        )
        .setScale(TILE_SCALE)
        .setDepth(0);
      }
    }

    // Walls — top & bottom (physics)
    for (let x = 0; x < COLS; x++) {
      const frame = x % 2 === 0 ? PATTERNS.COMMON_WALL : PATTERNS.COMMON_WALL_ALT;
      this.walls.add(
        this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, DISPLAY_TILE / 2, PATTERNS_KEY, frame)
          .setScale(TILE_SCALE).setDepth(1)
      );
      this.walls.add(
        this.add.image(x * DISPLAY_TILE + DISPLAY_TILE / 2, (ROWS - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame)
          .setScale(TILE_SCALE).setDepth(1)
      );
    }

    // Walls — left & right (physics)
    for (let y = 1; y < ROWS - 1; y++) {
      const frame = y % 2 === 0 ? PATTERNS.COMMON_WALL : PATTERNS.COMMON_WALL_ALT;
      this.walls.add(
        this.add.image(DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame)
          .setScale(TILE_SCALE).setDepth(1)
      );
      this.walls.add(
        this.add.image((COLS - 1) * DISPLAY_TILE + DISPLAY_TILE / 2, y * DISPLAY_TILE + DISPLAY_TILE / 2, PATTERNS_KEY, frame)
          .setScale(TILE_SCALE).setDepth(1)
      );
    }

    // ─── Gate at top center, one tile inside the wall ───
    this.gateX = GAME_WIDTH / 2;
    this.gateY = 1 * DISPLAY_TILE + DISPLAY_TILE / 2;

    // Gate tile
    this.add.image(this.gateX, this.gateY, PATTERNS_KEY, PATTERNS.DOOR).setScale(TILE_SCALE).setDepth(2);

    // Gate label BELOW the door
    this.add.text(this.gateX, this.gateY + DISPLAY_TILE, 'GATE', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.lg, color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(10);

    // Refresh all static bodies so scaled sizes are used for collision
    this.walls.refresh();
  }

  private createUI(): void {
    this.add.text(GAME_WIDTH / 2, (ROWS - 4) * DISPLAY_TILE, 'DEVQUEST', {
      fontFamily: FONTS.pixel, fontSize: '24px', color: COLORS.textHighlight,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, (ROWS - 3) * DISPLAY_TILE, 'Engineering Decision Simulator', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.md, color: COLORS.textSecondary,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(GAME_WIDTH / 2, (ROWS - 3) * DISPLAY_TILE + 30, 'Walk to the Gate and press E', {
      fontFamily: FONTS.pixel, fontSize: FONTS.size.sm, color: COLORS.textPrimary,
    }).setOrigin(0.5).setDepth(10);
  }

  private createPlayer(): void {
    // Start in lower center — player walks up to the gate
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT * 2 / 3);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  private checkGateProximity(): void {
    const dist = Phaser.Math.Distance.Between(
      this.player.sprite.x, this.player.sprite.y, this.gateX, this.gateY
    );

    if (dist < DISPLAY_TILE * 3) {
      if (!this.nearGate) {
        this.nearGate = true;
        this.showPrompt();
      }
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.scene.start('GateScene');
      }
    } else if (this.nearGate) {
      this.nearGate = false;
      this.hidePrompt();
    }
  }

  private showPrompt(): void {
    if (!this.promptText) {
      this.promptText = this.add.text(0, 0, 'Press E to Enter Gate', {
        fontFamily: FONTS.pixel, fontSize: FONTS.size.md,
        color: COLORS.textWarning,
        backgroundColor: '#1a1a2e',
        padding: { x: 6, y: 4 },
      }).setDepth(100);
    }
    this.promptText.setPosition(
      this.gateX - this.promptText.width / 2,
      this.gateY + DISPLAY_TILE * 2
    );
    this.promptText.setVisible(true);
  }

  private hidePrompt(): void {
    this.promptText?.setVisible(false);
  }
}
