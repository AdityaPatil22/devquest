import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GamePhase } from '../state/GameState';
import { SessionStore, type DecisionRecord } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';
import { DECISION_SPAWN } from '../tilemaps/decisionRoomTilemap';
import { CORRIDOR_MAP_TILE_SIZE, CORRIDOR_MAP_BOUNDS, CORRIDOR_MARKERS } from '../tilemaps/corridorTilemap';
import type { ServerMessage, DecisionCreatedMsg, SessionCompleteMsg, SessionResumedMsg } from '../net/protocol';
import { createSceneKeys, emitUI, type SceneKeys } from './support/sceneUi';
import { DecisionDoors } from './grilling/DecisionDoors';
import { GrillingWorld } from './grilling/GrillingWorld';
import type { DoorObject, WorldSegment } from './grilling/segment';
import { CorridorInteractionManager } from './grilling/CorridorInteractionManager';

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
  private unsubscribeWs?: () => void;
  private playerMoving = false;
  private gameplayBlocked = false;

  constructor() {
    super({ key: 'GrillingScene' });
  }

  preload(): void {
    this.load.image('door-closed', 'assets/items/door-closed.png');
    this.load.image('door-open', 'assets/items/door-open.png');
  }

  init(data: SceneData): void {
    this.ws = data.ws;
    this.store = data.store;
    this.phase = GamePhase.EXPLORING_DOORS;
    this.currentNodeId = data.decision.nodeId;
    this.data.set('decision', data.decision);
    this.data.set('restored', data.restored ?? false);
    this.stopCorridorProcessing();
    this.pendingDecision = undefined;
    this.corridorExitReached = false;
    this.corridorReady = false;
    this.gameplayBlocked = false;
    this.unsubscribeWs?.();
    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));
  }

  create(): void {
    this.createPlayer();
    this.keys = createSceneKeys(this);
    this.world ??= new GrillingWorld(this, this.player.sprite);
    this.doors ??= new DecisionDoors(this, this.player.sprite);
    this.corridorInteractions ??= new CorridorInteractionManager(this, this.player.sprite);
    this.world.setPlayer(this.player.sprite);
    this.doors.setPlayer(this.player.sprite);
    this.corridorInteractions.setPlayer(this.player.sprite);
    const decision = this.data.get('decision') as DecisionCreatedMsg;

    if (this.world.isEmpty) {
      this.showDecision(decision, this.world.buildDecisionRoom());
    } else {
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
      !this.gameplayBlocked &&
      (this.phase === GamePhase.EXPLORING_DOORS ||
        this.phase === GamePhase.TRAVERSING_OPTION ||
        this.phase === GamePhase.CORRIDOR_PROCESSING);

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

    if (this.phase === GamePhase.TRAVERSING_OPTION || this.phase === GamePhase.CORRIDOR_PROCESSING) {
      const nearest = this.corridorInteractions.update(this.world.activeCorridor);

      if (nearest && Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
        this.corridorInteractions.interact();
      }

      this.checkCorridorExit();
    }
  }

  shutdown(): void {
    this.stopCorridorProcessing();
    this.unsubscribeWs?.();
    this.unsubscribeWs = undefined;
    this.corridorInteractions?.reset();
    this.world?.destroyAll();
    this.doors?.reset();
    this.pendingDecision = undefined;
    this.corridorExitReached = false;
    this.corridorReady = false;
    this.playerMoving = false;
  }

  private showDecision(decision: DecisionCreatedMsg, room: WorldSegment): void {
    this.currentNodeId = decision.nodeId;
    this.gameplayBlocked = false;

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

  private approachDoor(door: DoorObject): void {
    this.phase = GamePhase.DOOR_CONTEXT;
    this.player.stop();
    this.doors.open(door);
    emitUI(this, { type: 'DOOR_CONTEXT', visible: true, option: door.option });
  }

  public confirmDoorSelection(context?: string): void {
    this.selectDoor(context);
  }

  public cancelDoorSelection(): void {
    this.selectDoor();
  }

  private startCorridorProcessing(): void {
    this.stopCorridorProcessing();
  
    emitUI(this, {
      type: 'CORRIDOR_PROCESSING',
      visible: true,
      stage: 'processing',
      message: 'Claude is generating the next decision...',
    });
  }

  private stopCorridorProcessing(): void {
    if (this.corridorProcessingTimer) {
      clearInterval(this.corridorProcessingTimer);
      this.corridorProcessingTimer = undefined;
    }
  }

  private checkCorridorExit(): void {
    const corridor = this.world.activeCorridor;
  
    if (!corridor || this.corridorExitReached || !this.corridorReady) {
      return;
    }
  
    const marker = CORRIDOR_MARKERS.roomExit;
    const origin = {
      x: CORRIDOR_MAP_BOUNDS.minTileX * CORRIDOR_MAP_TILE_SIZE,
      y: CORRIDOR_MAP_BOUNDS.minTileY * CORRIDOR_MAP_TILE_SIZE,
    };
    const exitX = corridor.x + marker.x + marker.width / 2 - origin.x;
    const exitY = corridor.y + marker.y + marker.height / 2 - origin.y;
  
    if (
      Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        exitX,
        exitY,
      ) <= 52
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

    this.stopCorridorProcessing();
    this.pendingDecision = undefined;
    this.corridorReady = false;
    this.corridorExitReached = false;
    const room = this.world.buildOptionRoom(corridor);

    emitUI(this, {
      type: 'CORRIDOR_PROCESSING',
      visible: false,
      stage: 'ready',
      message: 'Next decision ready',
    });

    this.showDecision(decision, room);
  }

  private selectDoor(context?: string): void {
    const door = this.doors.currentDoor;
    
    if (!door || this.phase !== GamePhase.DOOR_CONTEXT) {
      return;
    }
    
    this.gameplayBlocked = false;
    this.phase = GamePhase.CORRIDOR_PROCESSING;
    this.player.stop();
    this.store.updateCurrent({ selectedOptionId: door.option.id, context });
    this.world.createCorridor(door);
    this.doors.remove(door);
    this.pendingDecision = undefined;
    this.corridorExitReached = false;
    this.corridorReady = false;

    emitUI(this, { type: 'DOOR_PROXIMITY', visible: false });
    emitUI(this, {
      type: 'CORRIDOR_PROCESSING',
      visible: true,
      stage: 'received',
      message: 'Request received',
    });
    emitUI(this, { type: 'OBJECTIVE', objective: 'Reach the corridor exit' });
    this.startCorridorProcessing();

    this.ws.send({
      type: 'OPTION_SELECTED',
      nodeId: this.currentNodeId,
      optionId: door.option.id,
      context,
    });
  }

  public getDoorOptionAnchors() {
    return this.doors.anchors(this.world.activeRoom);
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'DECISION_CREATED':
        this.onDecisionCreated(msg);
        break;
      case 'SESSION_COMPLETE': {
        const complete = msg as SessionCompleteMsg;
        this.stopCorridorProcessing();
        this.store.complete(complete.summary, complete.docContent);
        this.player.stop();
        this.scene.start('TrophyScene', { store: this.store });
        break;
      }
      case 'SESSION_RESUMED':
        this.restoreFromSession(msg);
        break;
      case 'ERROR':
        this.failWith(msg.message);
        break;
    }
  }

  private restoreFromSession(msg: SessionResumedMsg): void {
    this.store.hydrate(msg.snapshot);
  
    if (msg.snapshot.phase === 'complete') {
      this.stopCorridorProcessing();
      this.player.stop();
      this.scene.start('TrophyScene', { store: this.store });
      return;
    }
  
    const decision = this.store.getCurrentDecision();
  
    if (!decision) {
      this.failWith('Unable to restore the current decision.');
      return;
    }
  
    this.currentNodeId = decision.nodeId;
  
    if (msg.snapshot.phase === 'awaiting_question') {
      this.phase = GamePhase.CORRIDOR_PROCESSING;
      this.pendingDecision = undefined;
      this.corridorReady = false;
      this.corridorExitReached = false;
      this.gameplayBlocked = false;
    
      if (this.world.activeCorridor) {
        this.world.lockCorridorExit(this.world.activeCorridor);
      }
    
      this.startCorridorProcessing();
    
      emitUI(this, {
        type: 'OBJECTIVE',
        objective: 'Claude is generating the next decision',
      });
    
      return;
    }
  
    if (msg.snapshot.phase !== 'awaiting_selection') {
      return;
    }
  
    const restoredDecision: DecisionCreatedMsg = {
      type: 'DECISION_CREATED',
      nodeId: decision.nodeId,
      question: decision.question,
      description: decision.description,
      options: decision.options,
      recommendation: decision.recommendation,
      round: decision.round,
    };
  
    const room = this.world.activeRoom ?? this.world.buildDecisionRoom();
  
    this.showDecision(restoredDecision, room);
    this.gameplayBlocked = false;
  
    emitUI(this, { type: 'SESSION_RESUMED' });
  }

  private onDecisionCreated(decision: DecisionCreatedMsg): void {
    if (decision.nodeId === this.currentNodeId || decision.round <= this.store.totalRounds) {
      return;
    }

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
      .find((record) => record.nodeId !== decision.nodeId && Boolean(record.selectedOptionId));

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
      this.gameplayBlocked = false;
      this.stopCorridorProcessing();
    
      if (this.world.activeCorridor) {
        this.world.unlockCorridorExit(this.world.activeCorridor);
      }
    
      emitUI(this, {
        type: 'CORRIDOR_PROCESSING',
        visible: true,
        stage: 'ready',
        message: 'Next decision ready — corridor exit unlocked',
      });
    
      emitUI(this, {
        type: 'OBJECTIVE',
        objective: 'Reach the corridor exit',
      });
    
      this.tryCommitPendingDecision();
      return;
    }

    const room = this.roomFor(decision);

    if (!room) {
      return;
    }

    this.showDecision(decision, room);
  }

  public closeWorkstation(): void {
    this.corridorInteractions.close();
  }

  private roomFor(decision: DecisionCreatedMsg): WorldSegment | undefined {
    if (decision.round === 1 && !this.world.activeCorridor) {
      return this.world.activeRoom ?? this.world.buildDecisionRoom();
    }

    const corridor = this.world.activeCorridor;

    if (!corridor) {
      this.failWith('Unable to create the next option room because the corridor is missing.');
      return undefined;
    }

    return this.world.buildOptionRoom(corridor);
  }

  private failWith(message: string): void {
    this.stopCorridorProcessing();
    this.pendingDecision = undefined;
    this.corridorReady = false;
    this.corridorExitReached = false;
    this.gameplayBlocked = true;
    this.player.stop();
  
    if (this.world.activeCorridor) {
      this.world.lockCorridorExit(this.world.activeCorridor);
    }
  
    this.corridorInteractions?.reset();
  
    emitUI(this, {
      type: 'CORRIDOR_PROCESSING',
      visible: false,
      stage: 'ready',
      message,
    });
  
    emitUI(this, { type: 'AI_THINKING', visible: false });
    emitUI(this, { type: 'ERROR', message });
  }

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

  private createPlayer(): void {
    this.player = new Player(this, DECISION_SPAWN.x, DECISION_SPAWN.y);
    this.player.sprite.setDepth(50);
    this.player.sprite.setCollideWorldBounds(false);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.2)
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
