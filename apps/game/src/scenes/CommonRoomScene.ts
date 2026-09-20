import Phaser from 'phaser';

import { Player } from '../entities/Player';

import { GameTextInput } from '../ui/GameTextInput';
import { TextButton } from '../ui/TextButton';

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  COLORS,
  FONTS,
} from '../config';

import {
  TILEMAP_KEY,
  MAP_TILESETS,
  MAP_TILE_SIZE,
  COLLIDABLE_OBJECT_LAYERS,
  DECOR_OBJECT_LAYERS,
  SPAWN_TILE,
  GATE_TILE,
} from '../tilemaps/commonRoomTilemap';

import { WebSocketClient } from '../net/WebSocketClient';
import { SessionStore } from '../state/SessionStore';

import type {
  ServerMessage,
  DecisionCreatedMsg,
} from '../net/protocol';

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;

  /**
   * Used when restoring a session that is currently
   * waiting for the skill to generate the first decision.
   */
  gateWaiting?: boolean;
}

const GATE_INPUT_WIDTH = 600;
const GATE_INPUT_HEIGHT = 120;

const GATE_INPUT_Y = 210;

const GATE_BUTTON_Y =
  GATE_INPUT_Y +
  GATE_INPUT_HEIGHT +
  40;

export class CommonRoomScene extends Phaser.Scene {
  private player!: Player;

  private map!: Phaser.Tilemaps.Tilemap;

  private groundLayer?: ReturnType<
    Phaser.Tilemaps.Tilemap['createLayer']
  >;

  private walls!: Phaser.Physics.Arcade.StaticGroup;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private interactKey!: Phaser.Input.Keyboard.Key;

  private escapeKey!: Phaser.Input.Keyboard.Key;

  private promptText?: Phaser.GameObjects.Text;

  private ws!: WebSocketClient;

  private store!: SessionStore;

  private gateX = 0;

  private gateY = 0;

  private nearGate = false;

  // ─────────────────────────────────────────────
  // Gate UI
  // ─────────────────────────────────────────────

  private gateOpen = false;

  private gateWaiting = false;

  private gateSubmitted = false;

  private gateOverlay?: Phaser.GameObjects.Rectangle;

  private gatePanel?: Phaser.GameObjects.Container;

  private gateTextInput?: GameTextInput;

  private gateSubmitButton?: TextButton;

  private gateStatusText?: Phaser.GameObjects.Text;

  private unsubscribeWs?: () => void;

  constructor() {
    super({
      key: 'CommonRoomScene',
    });
  }

  init(data: SceneData): void {
    this.ws = data.ws;
    this.store = data.store;

    this.gateWaiting =
      data.gateWaiting ?? false;

    this.gateOpen = false;
    this.gateSubmitted = false;
  }

  create(): void {
    this.walls =
      this.physics.add.staticGroup();

    this.buildRoom();

    this.createUI();

    this.createPlayer();

    this.physics.add.collider(
      this.player.sprite,
      this.walls,
    );

    if (this.groundLayer) {
      this.physics.add.collider(
        this.player.sprite,
        this.groundLayer,
      );
    }

    this.setupInput();

    this.unsubscribeWs =
      this.ws.onMessage(
        this.handleMessage.bind(this),
    );

    /*
     * If the session was restored while the server
     * was generating the first decision, immediately
     * show the gate waiting UI.
     */
    if (this.gateWaiting) {
      this.openGateWaiting();
    }
  }

  update(): void {
    /*
     * Don't allow the player to move while the
     * gate dialog is open.
     */
    if (this.gateOpen) {
      this.player.stop();

      /*
       * Escape closes the gate dialog only when
       * we're not waiting for the server.
       */
      if (
        !this.gateWaiting &&
        Phaser.Input.Keyboard.JustDown(
          this.escapeKey,
        )
      ) {
        this.closeGate();
      }

      return;
    }

    this.player.handleMovement(
      this.cursors,
    );

    this.checkGateProximity();
  }

  // ─────────────────────────────────────────────
  // Room
  // ─────────────────────────────────────────────

  private buildRoom(): void {
    this.map = this.make.tilemap({
      key: TILEMAP_KEY,
    });

    const tilesets = MAP_TILESETS
      .map((t) =>
        this.map.addTilesetImage(
          t.name,
          t.key,
        ),
      )
      .filter(
        (
          t,
        ): t is Phaser.Tilemaps.Tileset =>
          t !== null,
      );

    this.groundLayer =
      this.map.createLayer(
        'Ground',
        tilesets,
        0,
        0,
      ) ?? undefined;

    this.groundLayer?.setDepth(0);

    /*
     * Ground tiles with the collides property
     * block the player.
     */
    this.groundLayer?.setCollisionByProperty({
      collides: true,
    });

    /*
     * Collidable objects.
     */
    for (
      const layerName of
      COLLIDABLE_OBJECT_LAYERS
    ) {
      const objects =
        this.map.createFromObjects(
          layerName,
          {
            classType:
              Phaser.GameObjects.Image,
          },
        ) as Phaser.GameObjects.Image[];

      objects.forEach((obj) => {
        this.physics.add.existing(
          obj,
          true,
        );

        obj.setDepth(5);

        this.walls.add(obj);
      });
    }

    /*
     * Decorative objects.
     */
    for (
      const layerName of
      DECOR_OBJECT_LAYERS
    ) {
      const objects =
        this.map.createFromObjects(
          layerName,
          {
            classType:
              Phaser.GameObjects.Image,
          },
        ) as Phaser.GameObjects.Image[];

      objects.forEach((obj) => {
        obj.setDepth(4);
      });
    }

    const mapWidthPx =
      this.map.widthInPixels;

    const mapHeightPx =
      this.map.heightInPixels;

    this.physics.world.setBounds(
      0,
      0,
      mapWidthPx,
      mapHeightPx,
    );

    this.cameras.main.setBounds(
      0,
      0,
      mapWidthPx,
      mapHeightPx,
    );

    // ─────────────────────────────────────────
    // Gate
    // ─────────────────────────────────────────

    this.gateX =
      GATE_TILE.x *
        MAP_TILE_SIZE +
      MAP_TILE_SIZE / 2;

    this.gateY =
      GATE_TILE.y *
        MAP_TILE_SIZE +
      MAP_TILE_SIZE / 2;

    /*
     * Gate marker.
     */
    this.add
      .rectangle(
        this.gateX,
        this.gateY,
        MAP_TILE_SIZE,
        MAP_TILE_SIZE,
        0x4a9eff,
        0.35,
      )
      .setStrokeStyle(
        2,
        0x4a9eff,
      )
      .setDepth(3);

    this.add
      .text(
        this.gateX,
        this.gateY -
          MAP_TILE_SIZE,
        'GATE',
        {
          fontFamily:
            FONTS.pixel,
          fontSize:
            FONTS.size.lg,
          color:
            COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setDepth(10);
  }

  // ─────────────────────────────────────────────
  // HUD
  // ─────────────────────────────────────────────

  private createUI(): void {
    const HEADER_HEIGHT = 76;

    const FOOTER_HEIGHT = 40;

    this.add
      .rectangle(
        GAME_WIDTH / 2,
        HEADER_HEIGHT / 2,
        GAME_WIDTH,
        HEADER_HEIGHT,
        0x0a0a1a,
        0.75,
      )
      .setScrollFactor(0)
      .setDepth(98);

    this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT -
          FOOTER_HEIGHT / 2,
        GAME_WIDTH,
        FOOTER_HEIGHT,
        0x0a0a1a,
        0.75,
      )
      .setScrollFactor(0)
      .setDepth(98);

    this.add
      .text(
        GAME_WIDTH / 2,
        24,
        'DEVQUEST',
        {
          fontFamily:
            FONTS.pixel,
          fontSize: '24px',
          color:
            COLORS.textHighlight,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(
        GAME_WIDTH / 2,
        56,
        'Engineering Decision Simulator',
        {
          fontFamily:
            FONTS.pixel,
          fontSize:
            FONTS.size.md,
          color:
            COLORS.textSecondary,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT -
          FOOTER_HEIGHT / 2,
        'Walk to the Gate and press E',
        {
          fontFamily:
            FONTS.pixel,
          fontSize:
            FONTS.size.sm,
          color:
            COLORS.textPrimary,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
  }

  // ─────────────────────────────────────────────
  // Player
  // ─────────────────────────────────────────────

  private createPlayer(): void {
    const spawnX =
      SPAWN_TILE.x *
        MAP_TILE_SIZE +
      MAP_TILE_SIZE / 2;

    const spawnY =
      SPAWN_TILE.y *
        MAP_TILE_SIZE +
      MAP_TILE_SIZE / 2;

    this.player =
      new Player(
        this,
        spawnX,
        spawnY,
      );

    this.cameras.main.startFollow(
      this.player.sprite,
      true,
      0.15,
      0.15,
    );
  }

  // ─────────────────────────────────────────────
  // Input
  // ─────────────────────────────────────────────

  private setupInput(): void {
    this.cursors =
      this.input.keyboard!.createCursorKeys();

    this.interactKey =
      this.input.keyboard!.addKey(
        Phaser.Input.Keyboard.KeyCodes.E,
      );

    this.escapeKey =
      this.input.keyboard!.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC,
      );
  }

  // ─────────────────────────────────────────────
  // Gate proximity
  // ─────────────────────────────────────────────

  private checkGateProximity(): void {
    const dist =
      Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        this.gateX,
        this.gateY,
      );

    if (
      dist <
      MAP_TILE_SIZE * 3
    ) {
      if (!this.nearGate) {
        this.nearGate = true;

        this.showPrompt();
      }

      if (
        Phaser.Input.Keyboard.JustDown(
          this.interactKey,
        )
      ) {
        this.openGate();
      }
    } else if (
      this.nearGate
    ) {
      this.nearGate = false;

      this.hidePrompt();
    }
  }

  private showPrompt(): void {
    if (!this.promptText) {
      this.promptText =
        this.add.text(
          0,
          0,
          'Press E to Enter Gate',
          {
            fontFamily:
              FONTS.pixel,
            fontSize:
              FONTS.size.md,
            color:
              COLORS.textWarning,
            backgroundColor:
              '#1a1a2e',
            padding: {
              x: 6,
              y: 4,
            },
          },
        )
        .setDepth(100);
    }

    this.promptText.setPosition(
      this.gateX -
        this.promptText.width / 2,
      this.gateY +
        MAP_TILE_SIZE * 2,
    );

    this.promptText.setVisible(
      true,
    );
  }

  private hidePrompt(): void {
    this.promptText?.setVisible(
      false,
    );
  }

  // ─────────────────────────────────────────────
  // Gate UI
  // ─────────────────────────────────────────────

  private openGate(): void {
    if (this.gateOpen) {
      return;
    }

    this.gateOpen = true;

    this.nearGate = false;

    this.hidePrompt();

    this.createGatePanel();
  }

  private openGateWaiting(): void {
    if (this.gateOpen) {
      return;
    }

    this.gateOpen = true;
    this.nearGate = false;

    this.hidePrompt();

    this.createGatePanel();
  }

  private createGatePanel(): void {
    /*
     * Dark transparent overlay.
     */
    this.gateOverlay =
      this.add
        .rectangle(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2,
          GAME_WIDTH,
          GAME_HEIGHT,
          0x000000,
          0.55,
        )
        .setScrollFactor(0)
        .setDepth(140)
        .setInteractive();

    /*
     * Main panel.
     */
    const panelBg =
      this.add
        .rectangle(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2,
          700,
          430,
          COLORS.panelBg,
          0.98,
        )
        .setStrokeStyle(
          2,
          COLORS.panelBorder,
        )
        .setScrollFactor(0)
        .setDepth(150);

    const title =
      this.add
        .text(
          GAME_WIDTH / 2,
          90,
          'THE GATE',
          {
            fontFamily:
              FONTS.pixel,
            fontSize: '18px',
            color:
              COLORS.textHighlight,
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(151);

    const subtitle =
      this.add
        .text(
          GAME_WIDTH / 2,
          138,
          'What do you want to be grilled on?',
          {
            fontFamily:
              FONTS.pixel,
            fontSize:
              FONTS.size.lg,
            color:
              COLORS.textPrimary,
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(151);

    const subtitle2 =
      this.add
        .text(
          GAME_WIDTH / 2,
          166,
          'Enter your problem statement below',
          {
            fontFamily:
              FONTS.pixel,
            fontSize:
              FONTS.size.sm,
            color:
              COLORS.textSecondary,
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(151);

    this.gatePanel =
      this.add.container(
        0,
        0,
        [
          panelBg,
          title,
          subtitle,
          subtitle2,
        ],
      );

    this.gatePanel
      .setScrollFactor(0)
      .setDepth(150);

    /*
     * If the server is already generating the
     * decision, don't show the textarea.
     */
    if (this.gateWaiting) {
      this.showGateWaiting(
        'Waiting for the next decision...',
      );

      return;
    }

    this.createGateInput();
  }

  private createGateInput(): void {
    this.gateTextInput =
      new GameTextInput(
        this.game.canvas
          .parentElement as HTMLElement,
      );

    const canvasRect =
      this.game.canvas.getBoundingClientRect();

    const scaleX =
      canvasRect.width /
      this.cameras.main.width;

    const scaleY =
      canvasRect.height /
      this.cameras.main.height;

    const inputX =
      canvasRect.left +
      (
        GAME_WIDTH / 2 -
        GATE_INPUT_WIDTH / 2
      ) *
        scaleX;

    const inputY =
      canvasRect.top +
      GATE_INPUT_Y *
        scaleY;

    this.gateTextInput.show(
      inputX,
      inputY,
      GATE_INPUT_WIDTH *
        scaleX,
      GATE_INPUT_HEIGHT *
        scaleY,
      'e.g. "Should I rewrite the auth service in Go?" or "Design a caching strategy for our API"',
    );

    this.gateSubmitButton =
      new TextButton(
        this,
        {
          x:
            GAME_WIDTH / 2,
          y:
            GATE_BUTTON_Y,
          text:
            'ENTER THE GATE',
          width: 240,
          height: 40,
          onClick: () =>
            this.handleGateSubmit(),
        },
      );

    this.gateSubmitButton
      .container
      .setScrollFactor(0)
      .setDepth(160);
  }

  private handleGateSubmit(): void {
    if (
      this.gateSubmitted
    ) {
      return;
    }

    const problem =
      this.gateTextInput
        ?.getValue()
        .trim() ?? '';

    if (
      problem.length === 0
    ) {
      return;
    }

    this.gateSubmitted = true;

    this.store.setProblem(
      problem,
    );

    this.gateTextInput?.hide();

    this.gateSubmitButton?.destroy();

    this.gateWaiting = true;

    this.showGateWaiting(
      'Entering the gate...',
    );

    this.ws.send({
      type:
        'PROBLEM_SUBMITTED',
      problem,
    });
  }

  private showGateWaiting(
    message: string,
  ): void {
    this.gateStatusText?.destroy();

    this.gateStatusText =
      this.add
        .text(
          GAME_WIDTH / 2,
          410,
          message,
          {
            fontFamily:
              FONTS.pixel,
            fontSize:
              FONTS.size.sm,
            color:
              COLORS.textSecondary,
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(161);

    this.tweens.add({
      targets:
        this.gateStatusText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private closeGate(): void {
    if (
      this.gateWaiting
    ) {
      return;
    }

    this.gateOpen = false;

    this.gateTextInput?.hide();

    this.gateSubmitButton?.destroy();

    this.gateSubmitButton =
      undefined;

    this.gateStatusText?.destroy();

    this.gateStatusText =
      undefined;

    this.gatePanel?.destroy();

    this.gatePanel =
      undefined;

    this.gateOverlay?.destroy();

    this.gateOverlay =
      undefined;

    this.gateTextInput =
      undefined;

    this.gateSubmitted =
      false;
  }

  // ─────────────────────────────────────────────
  // WebSocket
  // ─────────────────────────────────────────────

  private handleMessage(
    msg: ServerMessage,
  ): void {
    switch (msg.type) {
      case 'SESSION_STARTED': {
        this.ws.setSessionId(
          msg.sessionId,
        );

        this.store.setSession(
          msg.sessionId,
        );

        break;
      }

      case 'SESSION_RESUMED': {
        this.ws.setSessionId(
          msg.sessionId,
        );

        this.store.hydrate(
          msg.snapshot,
        );

        break;
      }

      case 'DECISION_CREATED': {
        const decision =
          msg as DecisionCreatedMsg;

        this.store.addDecision({
          nodeId:
            decision.nodeId,
          question:
            decision.question,
          options:
            decision.options,
          recommendation:
            decision.recommendation,
          round:
            decision.round,
        });

        this.gateTextInput?.hide();

        this.scene.start(
          'DecisionRoomScene',
          {
            ws: this.ws,
            store: this.store,
            decision,
          },
        );

        break;
      }

      case 'ERROR': {
        console.error(
          'Server error:',
          msg.message,
        );

        this.gateSubmitted =
          false;

        this.gateWaiting =
          false;

        this.gateStatusText?.setText(
          `Error: ${msg.message}`,
        );

        break;
      }

      default:
        break;
    }
  }

  shutdown(): void {
    this.unsubscribeWs?.();
    this.unsubscribeWs = undefined;

    this.gateTextInput?.hide();

    this.gateSubmitButton?.destroy();
  }
}