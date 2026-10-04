/**
 * The grilling loop: present a decision as four doors, let the player walk
 * through one, and build the next room beyond it when the server replies.
 *
 * This scene owns the loop — phase, input, the player, the session and the
 * WebSocket. The world geometry lives in GrillingWorld and the doors in
 * DecisionDoors; both are asked, never consulted about the loop itself.
 */

import Phaser from 'phaser';

import { Player } from '../entities/Player';
import { GamePhase } from '../state/GameState';
import { SessionStore, type DecisionRecord } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';

import { DECISION_SPAWN } from '../tilemaps/decisionRoomTilemap';

import type { ServerMessage, DecisionCreatedMsg, SessionCompleteMsg } from '../net/protocol';

import { createSceneKeys, emitUI, type SceneKeys } from './support/sceneUi';
import { DecisionDoors } from './grilling/DecisionDoors';
import { GrillingWorld } from './grilling/GrillingWorld';
import type { DoorObject, WorldSegment } from './grilling/segment';
import { CorridorInteractionManager } from './grilling/CorridorInteractionManager';

import {
  CORRIDOR_MAP_TILE_SIZE,
  CORRIDOR_MAP_BOUNDS,
  CORRIDOR_MARKERS,
} from '../tilemaps/corridorTilemap';

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;
  decision: DecisionCreatedMsg;
  restored?: boolean;
}

export class GrillingScene extends Phaser.Scene {
  private player!: Player;

  private keys!: SceneKeys;

  private world!: GrillingWorld;

  private doors!: DecisionDoors;

  private ws!: WebSocketClient;

  private store!: SessionStore;

  private phase = GamePhase.EXPLORING_DOORS;

  private currentNodeId = '';

  private corridorInteractions!: CorridorInteractionManager;
  private pendingDecision?: DecisionCreatedMsg;
  private corridorExitReached = false;
  private corridorProcessingTimer?: ReturnType<typeof setInterval>;
  private corridorReady = false;
  private corridorExitTrigger?: Phaser.GameObjects.Zone;

  private unsubscribeWs?: () => void;

  /**
   * Tracks player movement so the React UI only receives state changes when
   * movement actually changes.
   */
  private playerMoving = false;

  constructor() {
    super({ key: 'GrillingScene' });
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  preload(): void {
    this.load.image('door-closed', 'assets/items/door-closed.png');

    this.load.image('door-open', 'assets/items/door-open.png');
  }

  init(data: SceneData): void {
    this.ws = data.ws;

    this.store = data.store;

    this.phase = GamePhase.EXPLORING_DOORS;

    this.currentNodeId = data.decision.nodeId;

    /*
     * IMPORTANT: the continuous world is intentionally NOT reset here. Every
     * segment built so far belongs to the run, not to this scene instance.
     */

    this.data.set('decision', data.decision);

    this.data.set('restored', data.restored ?? false);

    /* Prevent duplicate subscriptions if the scene is re-initialised. */
    this.unsubscribeWs?.();

    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));
  }

  create(): void {
    this.createPlayer();

    this.keys = createSceneKeys(this);

    /*
     * The world survives a scene restart, so it is created once and then
     * re-pointed at the player this `create()` just built.
     */
    this.world ??= new GrillingWorld(this, this.player.sprite);

    this.doors ??= new DecisionDoors(this, this.player.sprite);

    this.world.setPlayer(this.player.sprite);

    this.doors.setPlayer(this.player.sprite);

    this.corridorInteractions ??= new CorridorInteractionManager(this, this.player.sprite);
    this.corridorInteractions.setPlayer(this.player.sprite);

    const decision = this.data.get('decision') as DecisionCreatedMsg;

    if (this.world.isEmpty) {
      this.showDecision(decision, this.world.buildDecisionRoom());
    } else {
      /*
       * The scene was recreated while the world survived, so re-render the
       * current decision in whichever room is active.
       */
      const room = this.world.activeRoom ?? this.world.initialRoom;

      if (room) {
        this.world.activeRoom = room;

        this.showDecision(decision, room);
      }
    }

    if (this.data.get('restored') as boolean) {
      this.restoreCurrentPhase();
    }

    emitUI(this, { type: 'DECISION_ROOM_READY' });
  }

  update(): void {
    const canMove =
      this.phase === GamePhase.EXPLORING_DOORS ||
      this.phase === GamePhase.TRAVERSING_OPTION ||
      this.phase === GamePhase.CORRIDOR_PROCESSING ||
      this.phase === GamePhase.WORKSTATION;
  
    if (!canMove) {
      this.player.stop();
      this.setPlayerMoving(false);
      return;
    }
  
    this.player.handleMovement(this.keys.cursors);
  
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
  
    this.setPlayerMoving(Boolean(body && body.velocity.lengthSq() > 0));
  
    if (this.phase === GamePhase.EXPLORING_DOORS) {
      const nearest = this.doors.updateProximity(this.world.activeRoom);
  
      if (nearest && Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.approachDoor(nearest);
      }
  
      return;
    }
  
    if (
      this.phase === GamePhase.TRAVERSING_OPTION ||
      this.phase === GamePhase.CORRIDOR_PROCESSING ||
      this.phase === GamePhase.WORKSTATION
    ) {
      const nearest = this.corridorInteractions.update(this.world.activeCorridor);
  
      if (nearest && Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.corridorInteractions.interact();
        this.phase = GamePhase.WORKSTATION;
      }
  
      this.checkCorridorExit();
  
      if (this.corridorExitReached && this.pendingDecision) {
        this.commitPendingDecision();
      }
    }
  }

  shutdown(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs = undefined;

    this.world?.destroyAll();

    this.doors?.reset();

    this.playerMoving = false;

    this.corridorProcessingTimer &&
  clearInterval(this.corridorProcessingTimer);

this.corridorProcessingTimer = undefined;

this.corridorInteractions?.reset();

this.pendingDecision = undefined;
this.corridorExitReached = false;
this.corridorReady = false;
  }

  // ===========================================================================
  // Decisions
  // ===========================================================================

  /** Render a decision's doors in `room` and hand control back to the player. */
  private showDecision(decision: DecisionCreatedMsg, room: WorldSegment): void {
    this.currentNodeId = decision.nodeId;

    emitUI(this, {
      type: 'DECISION',
      nodeId: decision.nodeId,
      question: decision.question,
      description: decision.description,
      options: decision.options,
      recommendation: decision.recommendation,
      round: decision.round,
    });

    this.doors.render(decision, room);

    this.exploreDoors();
  }

  private exploreDoors(): void {
    this.phase = GamePhase.EXPLORING_DOORS;

    emitUI(this, { type: 'EXPLORING_DOORS' });
  }

  // ===========================================================================
  // Door Interaction
  // ===========================================================================

  private approachDoor(door: DoorObject): void {
    this.phase = GamePhase.DOOR_CONTEXT;

    this.player.stop();

    this.doors.open(door);

    emitUI(this, { type: 'DOOR_CONTEXT', visible: true, option: door.option });
  }

  /** Called by the React door-context modal. */
  public confirmDoorSelection(context?: string): void {
    this.selectDoor(context);
  }

  /**
   * Cancelling the modal commits the option without extra context rather than
   * returning to the room, matching the behaviour the UI was built against.
   */
  public cancelDoorSelection(): void {
    this.selectDoor();
  }

  private startCorridorProcessing(): void {
    this.corridorProcessingTimer &&
      clearInterval(this.corridorProcessingTimer);
  
    const stages: Array<{
      stage: 'received' | 'processing';
      message: string;
    }> = [
      {
        stage: 'received',
        message: 'Request received',
      },
      {
        stage: 'processing',
        message: 'Processing selected option...',
      },
    ];
  
    let index = 0;
  
    emitUI(this, {
      type: 'CORRIDOR_PROCESSING',
      visible: true,
      stage: stages[index].stage,
      message: stages[index].message,
    });
  
    this.corridorProcessingTimer = setInterval(() => {
      index = Math.min(index + 1, stages.length - 1);
  
      emitUI(this, {
        type: 'CORRIDOR_PROCESSING',
        visible: true,
        stage: stages[index].stage,
        message: stages[index].message,
      });
    }, 2500);
  }

  private checkCorridorExit(): void {
    const corridor = this.world.activeCorridor;
  
    if (!corridor || this.corridorExitReached) {
      return;
    }
  
    const marker = CORRIDOR_MARKERS.roomExit;
  
    const localX =
      marker.x +
      marker.width / 2 -
      CORRIDOR_MAP_BOUNDS.minTileX * CORRIDOR_MAP_TILE_SIZE;
  
    const localY =
      marker.y +
      marker.height / 2 -
      CORRIDOR_MAP_BOUNDS.minTileY * CORRIDOR_MAP_TILE_SIZE;
  
    const exitX = corridor.x + localX;
    const exitY = corridor.y + localY;
  
    if (
      Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        exitX,
        exitY,
      ) <= 40
    ) {
      this.corridorExitReached = true;
      this.tryCommitPendingDecision();
    }
  }

  private tryCommitPendingDecision(): void {
    if (!this.pendingDecision || !this.corridorExitReached || !this.corridorReady) {
      return;
    }
  
    this.commitPendingDecision();
  }

  private commitPendingDecision(): void {
    const decision = this.pendingDecision;
    const corridor = this.world.activeCorridor;
  
    if (!decision || !corridor) {
      return;
    }
  
    this.pendingDecision = undefined;
  
    this.world.setCorridorExitOpen(corridor, true);
  
    this.world.buildOptionRoom(corridor);
  
    emitUI(this, {
      type: 'CORRIDOR_PROCESSING',
      visible: false,
      stage: 'ready',
      message: 'Next decision ready',
    });
  
    emitUI(this, {
      type: 'OBJECTIVE',
      objective: 'Choose a door',
    });
  
    this.showDecision(decision, this.world.activeRoom!);
  }

  private selectDoor(context?: string): void {
    const door = this.doors.currentDoor;
  
    if (!door || this.phase !== GamePhase.DOOR_CONTEXT) {
      return;
    }
  
    this.phase = GamePhase.CORRIDOR_PROCESSING;
  
    this.player.stop();
  
    this.store.updateCurrent({
      selectedOptionId: door.option.id,
      context,
    });
  
    const corridor = this.world.createCorridor(door);
  
    this.world.setCorridorExitOpen(corridor, false);
  
    this.doors.remove(door);
  
    this.pendingDecision = undefined;
    this.corridorExitReached = false;
    this.corridorReady = false;
  
    emitUI(this, {
      type: 'CORRIDOR_PROCESSING',
      visible: true,
      stage: 'received',
      message: 'Request received',
    });
  
    emitUI(this, {
      type: 'OBJECTIVE',
      objective: 'Reach the green exit',
    });
  
    this.startCorridorProcessing();
  
    this.ws.send({
      type: 'OPTION_SELECTED',
      nodeId: this.currentNodeId,
      optionId: door.option.id,
      context,
    });
  }

  /** Read by the React overlay to pin option labels above each door. */
  public getDoorOptionAnchors() {
    return this.doors.anchors(this.world.activeRoom);
  }

  // ===========================================================================
  // Server Messages
  // ===========================================================================

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'DECISION_CREATED': {
        this.onDecisionCreated(msg as DecisionCreatedMsg);

        break;
      }

      case 'SESSION_COMPLETE': {
        const complete = msg as SessionCompleteMsg;

        this.store.complete(complete.summary, complete.docContent);

        this.player.stop();

        this.scene.start('TrophyScene', { store: this.store });

        break;
      }

      case 'SESSION_RESUMED': {
        emitUI(this, { type: 'SESSION_RESUMED' });

        break;
      }

      case 'ERROR': {
        console.error('[GrillingScene] Server error:', msg.message);

        this.failWith(msg.message);

        break;
      }
    }
  }

  private onDecisionCreated(decision: DecisionCreatedMsg): void {
    if (decision.nodeId === this.currentNodeId) {
      return;
    }
  
    emitUI(this, {
      type: 'AI_THINKING',
      visible: false,
    });
  
    this.store.addDecision({
      nodeId: decision.nodeId,
      question: decision.question,
      description: decision.description,
      options: decision.options,
      recommendation: decision.recommendation,
      round: decision.round,
    });
  
    const previousDecision = [...this.store.decisions]
      .reverse()
      .find(
        (record) =>
          record.nodeId !== decision.nodeId &&
          Boolean(record.selectedOptionId),
      );
  
    if (previousDecision) {
      this.emitDecisionHistory(
        previousDecision,
        decision.recommendation?.why,
        decision.recommendation?.option,
      );
    }
  
    if (this.phase === GamePhase.CORRIDOR_PROCESSING) {
      this.pendingDecision = decision;
      this.corridorReady = true;
  
      emitUI(this, {
        type: 'CORRIDOR_PROCESSING',
        visible: true,
        stage: 'ready',
        message: 'Next decision ready',
      });
  
      this.tryCommitPendingDecision();
      return;
    }
  
    const room = this.roomFor(decision);
  
    if (!room) {
      return;
    }
  
    emitUI(this, {
      type: 'OBJECTIVE',
      objective: 'Choose a door',
    });
  
    this.showDecision(decision, room);
  }

  private closeWorkstation(): void {
    this.corridorInteractions.close();
  
    if (this.phase === GamePhase.WORKSTATION) {
      this.phase = GamePhase.CORRIDOR_PROCESSING;
    }
  }

  /**
   * Round 1 stays in the original Decision Room. Every later decision is
   * rendered in a new option room built off the corridor the player walked
   * into when they picked the previous door.
   */
  private roomFor(decision: DecisionCreatedMsg): WorldSegment | undefined {
    if (decision.round === 1 && !this.world.activeCorridor) {
      return this.world.activeRoom ?? this.world.buildDecisionRoom();
    }

    const corridor = this.world.activeCorridor;

    if (!corridor) {
      console.error(
        '[GrillingScene] Missing corridor for decision:',
        decision.nodeId,
        'round:',
        decision.round,
      );

      this.failWith('Unable to create the next option room because the corridor is missing.');

      return undefined;
    }

    return this.world.buildOptionRoom(corridor);
  }

  private failWith(message: string): void {
    emitUI(this, { type: 'AI_THINKING', visible: false });

    emitUI(this, { type: 'ERROR', message });
  }

  // ===========================================================================
  // Decision History
  // ===========================================================================

  private emitDecisionHistory(
    record: DecisionRecord | undefined,
    explanationOverride?: string,
    recommendedOverride?: string,
  ): void {
    if (!record?.selectedOptionId) {
      return;
    }

    const selectedOption = record.options.find((option) => option.id === record.selectedOptionId);

    if (!selectedOption) {
      return;
    }

    const explanation = explanationOverride?.trim() || record.recommendation?.why?.trim();

    const recommendedOption = recommendedOverride?.trim() || record.recommendation?.option?.trim();

    if (!explanation && !recommendedOption) {
      return;
    }

    emitUI(this, {
      type: 'DECISION_HISTORY',
      entry: {
        nodeId: record.nodeId,
        round: record.round,
        question: record.question,
        selectedOption,
        explanation,
        recommendedOption,
      },
    });
  }

  private restoreCurrentPhase(): void {
    const decision = this.store.getCurrentDecision();

    if (!decision) {
      return;
    }

    for (const record of this.store.decisions) {
      if (record.nodeId !== decision.nodeId) {
        this.emitDecisionHistory(record);
      }
    }

    this.exploreDoors();
  }

  // ===========================================================================
  // Player
  // ===========================================================================

  private createPlayer(): void {
    this.player = new Player(this, DECISION_SPAWN.x, DECISION_SPAWN.y);

    this.player.sprite.setDepth(50);

    this.player.sprite.setCollideWorldBounds(false);

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    this.cameras.main.setDeadzone(120, 80);
  }

  private setPlayerMoving(moving: boolean): void {
    if (moving === this.playerMoving) {
      return;
    }

    this.playerMoving = moving;

    emitUI(this, { type: 'PLAYER_MOVING', visible: moving });
  }
}
