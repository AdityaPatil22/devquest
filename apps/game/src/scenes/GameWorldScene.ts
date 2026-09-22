import Phaser from 'phaser';

import { Player } from '../entities/Player';
import { GamePhase } from '../state/GameState';
import { SessionStore } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';

import {
  MAP_TILESETS,
  MAP_TILE_SIZE,
  COLLIDABLE_OBJECT_LAYERS,
  DECOR_OBJECT_LAYERS,
  SPAWN_TILE,
  GATE_TILE,
  TILEMAP_KEY,
} from '../tilemaps/commonRoomTilemap';

import {
  DECISION_TILEMAP_KEY,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  DECISION_TILE_LAYERS,
  DECISION_COLLIDABLE_LAYER,
  DECISION_MAP_BOUNDS,
  DECISION_DOOR_ROW_TILE_Y,
  DECISION_DOOR_ROW_X_RANGE,
  patchDecisionRoomTilesets,
} from '../tilemaps/decisionRoomTilemap';

import { emitUIEvent } from '../game/GameBridge';
import { RoomManager } from '../world/RoomManager';
import { RoomGenerationState } from '../state/RoomGenerationState';

import type {
  ServerMessage,
  DecisionCreatedMsg,
  DecisionOption,
  SessionResumedMsg,
} from '../net/protocol';

interface GameWorldData {
  ws: WebSocketClient;
  store: SessionStore;
  gateWaiting?: boolean;
  restored?: boolean;
}

interface DecisionLike {
  nodeId: string;
  question: string;
  options: DecisionOption[];
  recommendation?: DecisionCreatedMsg['recommendation'];
  round: number;
}

interface DoorObject {
  option: DecisionOption;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  isOpen: boolean;
}

interface WorldZone {
  id: string;
  kind: 'common' | 'decision' | 'corridor' | 'random';
  minX: number;
  maxX: number;
  centerY: number;
}

const DOOR_SCALE = 0.191;
const DOOR_OPEN_SCALE = 0.191;
const ZONE_GAP = 64;
const COMMON_WIDTH = 31 * MAP_TILE_SIZE;
const DECISION_WIDTH = (DECISION_MAP_BOUNDS.maxTileX - DECISION_MAP_BOUNDS.minTileX + 1) * DECISION_MAP_TILE_SIZE;
const SIDE_ACCESS = 96;
const PLAYER_JOIN_OFFSET_X = 48;

export class GameWorldScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private escapeKey!: Phaser.Input.Keyboard.Key;

  private ws!: WebSocketClient;
  private store!: SessionStore;
  private unsubscribeWs?: () => void;

  private phase = GamePhase.MENU;
  private zoneId = 'common-room';

  private commonMap?: Phaser.Tilemaps.Tilemap;
  private commonGround?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;
  private commonWalls!: Phaser.Physics.Arcade.StaticGroup;
  private gateX = 0;
  private gateY = 0;

  private decisionMap?: Phaser.Tilemaps.Tilemap;
  private decisionWalls?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;
  private persistentWallLayers: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>[] = [];

  private doors: DoorObject[] = [];
  private currentDoor?: DoorObject;
  private currentNodeId = '';

  private elevator?: Phaser.GameObjects.Sprite;
  private elevatorAnimating = false;
  private gateOpen = false;
  private gateWaiting = false;
  private gateSubmitted = false;
  private nearGate = false;
  private generatedDecisionCount = 0;
  private readonly roomGeneration = new RoomGenerationState();
  private readonly roomMapWidth = 70 * 16;
  private readonly roomMapHeight = 30 * 16;

  private zones: WorldZone[] = [];
  private roomManager = new RoomManager(undefined, { gap: ZONE_GAP });

  constructor() {
    super({ key: 'GameWorldScene' });
  }

  preload(): void {
    this.load.image('door-closed', 'assets/items/door-closed.png');
    this.load.image('door-open', 'assets/items/door-open.png');
  }

  init(data: GameWorldData): void {
    this.ws = data.ws;
    this.store = data.store;
    this.gateWaiting = data.gateWaiting ?? false;
    this.data.set('restored', data.restored ?? false);
  }

  create(): void {
    this.commonWalls = this.physics.add.staticGroup();

    this.buildWorld();

    this.createPlayer();
    this.setupInput();

    this.physics.add.collider(this.player.sprite, this.commonWalls);

    if (this.commonGround) {
      this.physics.add.collider(this.player.sprite, this.commonGround);
    }

    if (this.decisionWalls) {
      this.physics.add.collider(this.player.sprite, this.decisionWalls);
    }

    this.persistentWallLayers.forEach((layer) => {
      if (layer) this.physics.add.collider(this.player.sprite, layer);
    });

    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));

    if (this.store.getCurrentDecision()) {
      const current = this.store.getCurrentDecision()!;
      this.activateDecision({
        nodeId: current.nodeId,
        question: current.question,
        options: current.options,
        recommendation: current.recommendation,
        round: current.round,
      }, Boolean(this.data.get('restored')));
    } else {
      this.setZone('common-room');
      this.emitUI({ type: 'COMMON_ROOM_READY' });

      if (this.gateWaiting) {
        this.openGateWaiting();
        this.phase = GamePhase.WAITING_FOR_QUESTION;
      }
    }
  }

  update(): void {
    if (!this.player || !this.cursors) return;

    if (this.isUiBlocking()) {
      this.player.stop();

      if (this.phase === GamePhase.DOOR_CONTEXT && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
        this.cancelDoorSelection();
      } else if (this.gateOpen && !this.gateWaiting && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
        this.closeGate();
      }

      return;
    }

    this.player.handleMovement(this.cursors);
    this.store.setPlayerPosition(this.player.sprite.x, this.player.sprite.y);

    this.checkInteractions();
    this.checkZoneTransition();
  }

  private buildWorld(): void {
    this.roomManager.clear();
    this.zones = [];
    this.roomGeneration.reset();

    this.buildCommonRoom();
    this.buildDecisionRoom();

    // Keep only the first corridor/room pair ready; later pairs are generated on demand.
    this.appendRoomMap('corridor', 1, 'corridor', 'corridor', this.roomMapWidth, this.roomMapHeight);
    this.appendRoomMap('room', 1, 'room-1', 'random', this.roomMapWidth, this.roomMapHeight);

    const lastRoom = this.roomManager.getLastRoom();
    if (!lastRoom) return;

    const worldMinX = 0;
    const worldMaxX = lastRoom.bounds.x + lastRoom.bounds.width + SIDE_ACCESS;
    const worldHeight = Math.max(COMMON_WIDTH, 624) + 2 * SIDE_ACCESS;
    const worldMinY = -SIDE_ACCESS;

    this.physics.world.setBounds(worldMinX, worldMinY, worldMaxX - worldMinX, worldHeight);
    this.cameras.main.setBounds(worldMinX, worldMinY, worldMaxX - worldMinX, worldHeight);
  }

  private buildCommonRoom(): void {
    const map = this.make.tilemap({ key: TILEMAP_KEY });
    this.commonMap = map;

    const tilesets = MAP_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    const ground = map.createLayer('Ground', tilesets, 0, 0);
    this.commonGround = ground ?? undefined;
    ground?.setDepth(0);
    ground?.setCollisionByProperty({ collides: true });

    for (const layerName of COLLIDABLE_OBJECT_LAYERS) {
      const objects = map.createFromObjects(layerName, {
        classType: Phaser.GameObjects.Image,
      }) as Phaser.GameObjects.Image[];

      for (const object of objects) {
        this.physics.add.existing(object, true);
        object.setDepth(5);
        this.commonWalls.add(object);
      }
    }

    for (const layerName of DECOR_OBJECT_LAYERS) {
      const objects = map.createFromObjects(layerName, {
        classType: Phaser.GameObjects.Image,
      }) as Phaser.GameObjects.Image[];
      objects.forEach((object) => object.setDepth(4));
    }

    this.gateX = GATE_TILE.x * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    this.gateY = GATE_TILE.y * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    this.elevator = this.add
      .sprite(this.gateX, this.gateY + MAP_TILE_SIZE / 2, 'elevator', 0)
      .setOrigin(0.5, 1)
      .setScale(0.35)
      .setDepth(10);

    const elevatorCollider = this.add.rectangle(
      this.gateX,
      this.gateY - 10,
      105,
      110,
      0xffffff,
      0,
    );
    this.physics.add.existing(elevatorCollider, true);
    this.commonWalls.add(elevatorCollider);

    const room = this.roomManager.addRoom({
      id: 'common-room',
      kind: 'common',
      mapKey: TILEMAP_KEY,
      size: { width: COMMON_WIDTH, height: this.commonMap?.heightInPixels ?? 0 },
      connections: [
        {
          id: 'common-to-decision',
          kind: 'exit',
          direction: 'east',
          position: { x: COMMON_WIDTH, y: this.gateY },
        },
      ],
    });

    this.store.registerRoom({
      id: room.id,
      mapKey: room.mapKey,
      kind: room.kind,
      order: 0,
      generatedAt: Date.now(),
      metadata: { minX: room.bounds.x, maxX: room.bounds.x + room.bounds.width },
    });

    this.zones.push({
      id: room.id,
      kind: room.kind as WorldZone['kind'],
      minX: room.bounds.x,
      maxX: room.bounds.x + room.bounds.width,
      centerY: room.bounds.y + room.bounds.height / 2,
    });
  }

  private buildDecisionRoom(): void {
    const cached = this.cache.tilemap.get(DECISION_TILEMAP_KEY);
    if (cached?.data) {
      patchDecisionRoomTilesets(cached.data);
    }

    const map = this.make.tilemap({ key: DECISION_TILEMAP_KEY });
    this.decisionMap = map;

    const tilesets = DECISION_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    const decisionOffsetX = this.roomManager.nextX - DECISION_MAP_BOUNDS.minTileX * DECISION_MAP_TILE_SIZE;

    DECISION_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = map.createLayer(layerName, tilesets, decisionOffsetX, 0);
      layer?.setDepth(depth + 2);

      if (layerName === DECISION_COLLIDABLE_LAYER) {
        layer?.setCollisionByExclusion([-1]);
        this.decisionWalls = layer ?? undefined;
      }
    });

    const room = this.roomManager.addRoom({
      id: 'decision-room',
      kind: 'decision',
      mapKey: DECISION_TILEMAP_KEY,
      attachTo: { roomId: 'common-room', connectionId: 'common-to-decision' },
      size: {
        width: DECISION_WIDTH,
        height: (DECISION_MAP_BOUNDS.maxTileY - DECISION_MAP_BOUNDS.minTileY + 1) * DECISION_MAP_TILE_SIZE,
      },
      connections: [
        {
          id: 'decision-to-common',
          kind: 'entrance',
          direction: 'west',
          position: { x: 0, y: 16 * DECISION_MAP_TILE_SIZE },
        },
        {
          id: 'decision-to-next',
          kind: 'exit',
          direction: 'east',
          position: { x: DECISION_WIDTH, y: 16 * DECISION_MAP_TILE_SIZE },
        },
      ],
    });

    this.store.registerRoom({
      id: room.id,
      mapKey: room.mapKey,
      kind: room.kind,
      order: 1,
      generatedAt: Date.now(),
      metadata: { minX: room.bounds.x, maxX: room.bounds.x + room.bounds.width },
    });

    this.zones.push({
      id: room.id,
      kind: room.kind as WorldZone['kind'],
      minX: room.bounds.x,
      maxX: room.bounds.x + room.bounds.width,
      centerY: room.bounds.y + room.bounds.height / 2,
    });
  }

  private buildRepeatedMapZones(
    prefix: string,
    kind: 'corridor' | 'random',
    count: number,
    isCorridor: boolean,
  ): void {
    const mapKeys = isCorridor
      ? Array.from({ length: count }, () => 'corridor')
      : ['room-1', 'room-2', 'room-3', 'room-4'];

    const tileWidth = 16;
    const mapWidth = 70 * tileWidth;
    const mapHeight = 30 * tileWidth;

    for (let index = 0; index < count; index += 1) {
      this.appendRoomMap(prefix, index + 1, mapKeys[index]!, kind, mapWidth, mapHeight);
    }
  }

  private appendRoomMap(
    prefix: string,
    index: number,
    mapKey: string,
    kind: 'corridor' | 'random',
    mapWidth: number,
    mapHeight: number,
  ): void {
    const roomId = `${prefix}-${index}`;
    const previousRoom = this.roomManager.getLastRoom();
    const room = this.roomManager.addRoom({
      id: roomId,
      kind,
      mapKey,
      attachTo: previousRoom
        ? { roomId: previousRoom.id, connectionId: previousRoom.getExit()?.id }
        : undefined,
      size: { width: mapWidth, height: mapHeight },
      connections: [
        {
          id: `${roomId}-west`,
          kind: 'entrance',
          direction: 'west',
          position: { x: 0, y: mapHeight / 2 },
        },
        {
          id: `${roomId}-east`,
          kind: 'exit',
          direction: 'east',
          position: { x: mapWidth, y: mapHeight / 2 },
        },
      ],
    });

    const map = this.make.tilemap({ key: mapKey });
    const tilesets = DECISION_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    DECISION_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = map.createLayer(
        layerName,
        tilesets,
        room.bounds.x - (-16 * MAP_TILE_SIZE),
        room.bounds.y,
      );
      layer?.setDepth(depth + 1);

      if (layerName === DECISION_COLLIDABLE_LAYER) {
        layer?.setCollisionByExclusion([-1]);
        if (layer) this.persistentWallLayers.push(layer);
      }
    });

    this.zones.push({
      id: room.id,
      kind,
      minX: room.bounds.x,
      maxX: room.bounds.x + room.bounds.width,
      centerY: room.bounds.y + room.bounds.height / 2,
    });

    this.store.registerRoom({
      id: room.id,
      mapKey: room.mapKey,
      kind,
      variant: kind === 'random' ? String(index) : undefined,
      order: this.zones.length - 1,
      generatedAt: Date.now(),
      metadata: { minX: room.bounds.x, maxX: room.bounds.x + room.bounds.width },
    });

    if (previousRoom) {
      const previousExit = previousRoom.getExit();
      const entrance = room.getEntrance();
      if (previousExit && entrance) {
        this.roomManager.connectSequentially(
          previousRoom.id,
          previousExit.id,
          room.id,
          entrance.id,
        );
      }
    }
  }

  private createPlayer(): void {
    const saved = this.store.playerState;
    const current = this.store.getCurrentDecision();

    const fallbackX = current
      ? this.zones.find((zone) => zone.id === 'decision-room')!.minX + 30 * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2
      : SPAWN_TILE.x * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
    const fallbackY = current
      ? 16 * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2
      : SPAWN_TILE.y * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;

    const hasSavedRoom = Boolean(
      saved.currentRoomId && this.zones.some((zone) => zone.id === saved.currentRoomId),
    );
    const roomId = hasSavedRoom ? saved.currentRoomId : current ? 'decision-room' : 'common-room';
    const x = hasSavedRoom ? saved.position.x : fallbackX;
    const y = hasSavedRoom ? saved.position.y : fallbackY;

    this.player = new Player(this, x, y);

    this.store.setPlayerPosition(x, y);
    this.store.setPlayerRoom(roomId);
    this.setZone(roomId ?? 'common-room');
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.escapeKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  private checkInteractions(): void {
    if (this.zoneId === 'common-room') {
      this.checkGateProximity();
    }

    if (this.zoneId === 'decision-room') {
      this.checkDoorProximity();
    }
  }

  private checkGateProximity(): void {
    const distance = Phaser.Math.Distance.Between(
      this.player.sprite.x,
      this.player.sprite.y,
      this.gateX,
      this.gateY + MAP_TILE_SIZE * 2,
    );

    if (distance < MAP_TILE_SIZE * 3) {
      if (!this.nearGate) {
        this.nearGate = true;
        this.emitUI({ type: 'ELEVATOR_PROXIMITY', visible: true });
      }

      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.openGate();
      }
    } else if (this.nearGate) {
      this.nearGate = false;
      this.emitUI({ type: 'ELEVATOR_PROXIMITY', visible: false });
    }
  }

  private playElevatorAnimation(): void {
    if (!this.elevator || this.elevatorAnimating) return;
    this.elevatorAnimating = true;
    this.elevator.setFrame(0);
    this.time.delayedCall(150, () => this.elevator?.setFrame(1));
    this.time.delayedCall(300, () => this.elevator?.setFrame(2));
    this.time.delayedCall(450, () => {
      this.elevatorAnimating = false;
    });
  }

  private openGate(): void {
    if (this.gateOpen) return;
    this.gateOpen = true;
    this.nearGate = false;
    this.emitUI({ type: 'ELEVATOR_PROXIMITY', visible: false });
    this.playElevatorAnimation();
    this.emitUI({ type: 'ELEVATOR_OPEN', waiting: false });
  }

  private openGateWaiting(): void {
    this.gateOpen = true;
    this.gateWaiting = true;
    this.elevator?.setFrame(2);
    this.emitUI({
      type: 'ELEVATOR_OPEN',
      waiting: true,
      message: 'Waiting for the next decision...',
    });
  }

  public submitProblem(problem: string): void {
    const trimmed = problem.trim();
    if (!trimmed || this.gateSubmitted) return;

    this.gateSubmitted = true;
    this.gateWaiting = true;
    this.store.setProblem(trimmed);

    this.emitUI({
      type: 'ELEVATOR_SUBMITTING',
      message: 'Entering the elevator...',
    });

    this.ws.send({
      type: 'PROBLEM_SUBMITTED',
      problem: trimmed,
    });
  }

  public closeGate(): void {
    if (this.gateWaiting) return;

    this.gateOpen = false;
    this.gateWaiting = false;
    this.gateSubmitted = false;
    this.elevator?.setFrame(0);
    this.elevatorAnimating = false;
    this.emitUI({ type: 'ELEVATOR_CLOSED' });
  }

  private activateDecision(decision: DecisionLike, restored = false): void {
    this.setZone('decision-room');
    this.phase = GamePhase.EXPLORING_DOORS;
    this.currentNodeId = decision.nodeId;
    this.store.setPlayerRoom('decision-room');

    const room = this.zones.find((zone) => zone.id === 'decision-room');
    if (room) {
      const spawnX = room.minX + 30 * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;
      const spawnY = 16 * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;
      this.player.setPosition(spawnX, spawnY);
      this.store.setPlayerPosition(spawnX, spawnY);
      this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    }

    this.renderDecision(decision);
    this.emitUI({ type: 'DECISION_ROOM_READY' });

    if (restored) {
      this.restoreCurrentPhase();
    }
  }

  private renderDecision(decision: DecisionLike): void {
    this.clearDecision();
    this.currentNodeId = decision.nodeId;

    this.emitUI({
      type: 'DECISION',
      nodeId: decision.nodeId,
      question: decision.question,
      options: decision.options,
      recommendation: decision.recommendation,
      round: decision.round,
    });

    const room = this.zones.find((zone) => zone.id === 'decision-room')!;
    const rangeStartPx = room.minX + DECISION_DOOR_ROW_X_RANGE.minTileX * DECISION_MAP_TILE_SIZE;
    const rangeWidthPx =
      (DECISION_DOOR_ROW_X_RANGE.maxTileX - DECISION_DOOR_ROW_X_RANGE.minTileX + 1) *
      DECISION_MAP_TILE_SIZE;

    const spacing = decision.options.length > 0
      ? Math.min(120, rangeWidthPx / (decision.options.length + 1))
      : 120;

    const doorY = DECISION_DOOR_ROW_TILE_Y * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;

    decision.options.forEach((option, index) => {
      const doorX = rangeStartPx + spacing * (index + 1);
      const sprite = this.add
        .image(doorX, doorY, 'door-closed')
        .setOrigin(0.5, 1.42)
        .setDepth(7)
        .setScale(DOOR_SCALE);

      this.doors.push({
        option,
        x: doorX,
        y: doorY,
        sprite,
        isOpen: false,
      });
    });

    this.emitUI({ type: 'EXPLORING_DOORS' });
  }

  private clearDecision(): void {
    this.doors.forEach((door) => door.sprite.destroy());
    this.doors = [];
    this.currentDoor = undefined;
  }

  private checkDoorProximity(): void {
    let nearest: DoorObject | undefined;
    let minDistance = Infinity;

    for (const door of this.doors) {
      const distance = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        door.x,
        door.y,
      );

      if (distance < 50 && distance < minDistance) {
        minDistance = distance;
        nearest = door;
      }
    }

    if (nearest && nearest !== this.currentDoor) {
      this.currentDoor = nearest;
      nearest.sprite.setTint(0xffaa44);
      this.emitUI({ type: 'DOOR_PROXIMITY', visible: true, option: nearest.option });
    } else if (!nearest && this.currentDoor) {
      this.currentDoor = undefined;
      this.doors.forEach((door) => door.sprite.clearTint());
      this.emitUI({ type: 'DOOR_PROXIMITY', visible: false });
    }

    if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.approachDoor(nearest);
    }
  }

  private approachDoor(door: DoorObject): void {
    this.phase = GamePhase.DOOR_CONTEXT;
    this.currentDoor = door;
    door.isOpen = true;
    door.sprite.setTexture('door-open').setOrigin(0.5, 1.32).setScale(DOOR_OPEN_SCALE);
    this.emitUI({ type: 'DOOR_CONTEXT', visible: true, option: door.option });
  }

  public confirmDoorSelection(context?: string): void {
    if (!this.currentDoor || this.phase !== GamePhase.DOOR_CONTEXT) return;
    if (this.roomGeneration.status === 'generating') return;

    const optionId = this.currentDoor.option.id;
    this.phase = GamePhase.WAITING_FOR_CHALLENGE;
    this.store.updateCurrent({ selectedOptionId: optionId, context });
    void this.generateNextRoomForSelection();

    this.ws.send({
      type: 'OPTION_SELECTED',
      nodeId: this.currentNodeId,
      optionId,
      context,
    });
  }

  public get roomGenerationStatus() {
    return this.roomGeneration.snapshot;
  }

  private async generateNextRoomForSelection(): Promise<void> {
    if (!this.roomGeneration.begin()) return;

    this.emitGenerationFeedback('generating', 'Preparing the next room...');
    await Promise.resolve();

    try {
      const corridorNumber = this.roomManager.getRooms('corridor').length + 1;
      const roomNumber = this.roomManager.getRooms('random').length + 1;

      if (roomNumber > 4) {
        this.roomGeneration.ready();
        this.emitGenerationFeedback('ready', 'The world is ready.');
        return;
      }

      this.generatedDecisionCount += 1;
      this.appendGeneratedRoom('corridor', corridorNumber, 'corridor');
      this.appendGeneratedRoom('room', roomNumber, `room-${roomNumber}`);

      const nextRoom = this.roomManager.getRoom(`room-${roomNumber}`);
      const entrance = nextRoom.getEntrance();

      if (entrance) {
        const targetX = nextRoom.bounds.x + entrance.position.x + PLAYER_JOIN_OFFSET_X;
        const targetY = nextRoom.bounds.y + entrance.position.y;
        this.player.setPosition(targetX, targetY);
        this.store.setPlayerPosition(targetX, targetY);
        this.setZone(nextRoom.id);
      }

      this.extendWorldBounds();
      this.positionPlayerAtRoomEntrance(nextRoom.id);
      this.roomGeneration.ready();
      this.emitGenerationFeedback('ready', 'The next room is ready.');
    } catch (error) {
      this.roomGeneration.fail(error);
      this.emitGenerationFeedback(
        'error',
        `Could not prepare the next room: ${this.roomGeneration.error ?? 'unknown error'}`,
      );
      this.phase = GamePhase.EXPLORING_DOORS;
      this.currentDoor = undefined;
      this.emitUI({ type: 'DOOR_CONTEXT', visible: false });
    }
  }

  private positionPlayerAtRoomEntrance(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    const entrance = room.getEntrance();
    if (!entrance) return;

    const targetX = room.bounds.x + entrance.position.x + PLAYER_JOIN_OFFSET_X;
    const targetY = room.bounds.y + entrance.position.y;

    this.player.setPosition(targetX, targetY);
    this.store.setPlayerPosition(targetX, targetY);
    this.setZone(room.id);

    this.cameras.main.centerOn(targetX, targetY);
  }

  private extendWorldBounds(): void {
    const lastRoom = this.roomManager.getLastRoom();
    if (!lastRoom) return;

    const worldMinX = 0;
    const worldMaxX = lastRoom.bounds.x + lastRoom.bounds.width + SIDE_ACCESS;
    const worldHeight = Math.max(COMMON_WIDTH, 624) + 2 * SIDE_ACCESS;

    this.physics.world.setBounds(worldMinX, -SIDE_ACCESS, worldMaxX - worldMinX, worldHeight);
    this.cameras.main.setBounds(worldMinX, -SIDE_ACCESS, worldMaxX - worldMinX, worldHeight);
  }

  private emitGenerationFeedback(
    status: 'generating' | 'ready' | 'error',
    message: string,
  ): void {
    this.emitUI({ type: 'WAITING', message, generationStatus: status });
  }

  private appendGeneratedRoom(prefix: 'corridor' | 'room', index: number, mapKey: string): void {
    const roomId = `${prefix}-${index}`;
    const kind = prefix === 'corridor' ? 'corridor' : 'random';
    const map = this.make.tilemap({ key: mapKey });
    const previousRoom = this.roomManager.getLastRoom();

    const room = this.roomManager.addRoom({
      id: roomId,
      kind,
      mapKey,
      attachTo: previousRoom
        ? { roomId: previousRoom.id, connectionId: previousRoom.getExit()?.id }
        : undefined,
      size: { width: mapWidth, height: mapHeight },
      connections: [
        {
          id: `${roomId}-west`,
          kind: 'entrance',
          direction: 'west',
          position: { x: 0, y: mapHeight / 2 },
        },
        {
          id: `${roomId}-east`,
          kind: 'exit',
          direction: 'east',
          position: { x: mapWidth, y: mapHeight / 2 },
        },
      ],
    });

    const tilesets = DECISION_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    DECISION_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = map.createLayer(
        layerName,
        tilesets,
        room.bounds.x - (-16 * MAP_TILE_SIZE),
        room.bounds.y,
      );
      layer?.setDepth(depth + 1);

      if (layerName === DECISION_COLLIDABLE_LAYER) {
        layer?.setCollisionByExclusion([-1]);
        if (layer) {
          this.persistentWallLayers.push(layer);
          this.physics.add.collider(this.player.sprite, layer);
        }
      }
    });

    this.zones.push({
      id: room.id,
      kind,
      minX: room.bounds.x,
      maxX: room.bounds.x + room.bounds.width,
      centerY: room.bounds.y + room.bounds.height / 2,
    });

    this.store.registerRoom({
      id: room.id,
      mapKey: room.mapKey,
      kind,
      variant: kind === 'random' ? String(index) : undefined,
      order: this.zones.length - 1,
      generatedAt: Date.now(),
      metadata: { minX: room.bounds.x, maxX: room.bounds.x + room.bounds.width },
    });

    if (previousRoom) {
      const previousExit = previousRoom.getExit();
      const entrance = room.getEntrance();
      if (previousExit && entrance) {
        this.roomManager.connect(previousRoom.id, previousExit.id, room.id, entrance.id);
      }
    }
  }

  public cancelDoorSelection(): void {
    if (this.phase !== GamePhase.DOOR_CONTEXT) return;

    if (this.currentDoor) {
      this.currentDoor.isOpen = false;
      this.currentDoor.sprite
        .setTexture('door-closed')
        .setOrigin(0.5, 1.42)
        .setScale(DOOR_SCALE);
    }

    this.phase = GamePhase.EXPLORING_DOORS;
    this.currentDoor = undefined;
    this.emitUI({ type: 'DOOR_CONTEXT', visible: false });
  }

  public submitDefense(defense: string): void {
    const trimmed = defense.trim();
    if (!trimmed) return;

    const decision = this.store.getCurrentDecision();
    if (!decision) return;

    this.phase = GamePhase.WAITING_FOR_EVALUATION;
    this.player.stop();
    this.store.updateCurrent({ defense: trimmed });
    this.emitUI({ type: 'WAITING', message: 'Waiting for evaluation...' });

    this.ws.send({
      type: 'CHALLENGE_RESPONSE',
      nodeId: this.currentNodeId,
      response: trimmed,
    });
  }

  private restoreCurrentPhase(): void {
    const decision = this.store.getCurrentDecision();
    if (!decision) return;

    if (decision.selectedOptionId && !decision.challenge) {
      this.phase = GamePhase.WAITING_FOR_CHALLENGE;
      this.emitUI({ type: 'WAITING', message: 'Waiting for the challenge...' });
      return;
    }

    if (decision.challenge && !decision.defense) {
      this.phase = GamePhase.RESPONDING_TO_CHALLENGE;
      this.emitUI({ type: 'CHALLENGE', question: decision.challenge });
      return;
    }

    if (decision.defense && !decision.feedback) {
      this.phase = GamePhase.WAITING_FOR_EVALUATION;
      this.emitUI({ type: 'WAITING', message: 'Waiting for evaluation...' });
      return;
    }

    if (decision.feedback) {
      this.phase = GamePhase.SHOWING_EVALUATION;
      this.emitUI({
        type: 'EVALUATION',
        feedback: decision.feedback,
        consequence: decision.consequence ?? '',
      });
      return;
    }

    this.phase = GamePhase.EXPLORING_DOORS;
    this.emitUI({ type: 'EXPLORING_DOORS' });
  }

  private checkZoneTransition(): void {
    const playerX = this.player.sprite.x;
    const currentIndex = this.zones.findIndex((zone) => zone.id === this.zoneId);
    if (currentIndex < 0) return;

    let nextZone = this.zones[currentIndex];
    for (const zone of this.zones) {
      if (playerX >= zone.minX && playerX <= zone.maxX) {
        nextZone = zone;
        break;
      }
    }

    if (nextZone.id !== this.zoneId) {
      this.setZone(nextZone.id);
    }
  }

  private setZone(zoneId: string): void {
    const zone = this.zones.find((item) => item.id === zoneId);
    if (!zone) return;

    this.zoneId = zoneId;
    this.store.setPlayerRoom(zoneId);

    if (zone.kind === 'decision' && this.store.getCurrentDecision()) {
      this.phase = this.phase === GamePhase.MENU
        ? GamePhase.EXPLORING_DOORS
        : this.phase;
      this.emitUI({ type: 'DECISION_ROOM_READY' });
    } else if (zone.kind === 'common') {
      this.emitUI({ type: 'COMMON_ROOM_READY' });
    }
  }

  private isUiBlocking(): boolean {
    return (
      this.gateOpen ||
      this.phase === GamePhase.DOOR_CONTEXT ||
      this.phase === GamePhase.RESPONDING_TO_CHALLENGE ||
      this.phase === GamePhase.WAITING_FOR_EVALUATION ||
      this.phase === GamePhase.SHOWING_EVALUATION
    );
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'SESSION_STARTED':
        this.ws.setSessionId(msg.sessionId);
        this.store.setSession(msg.sessionId);
        this.emitUI({ type: 'SESSION_STARTED', sessionId: msg.sessionId });
        break;

      case 'SESSION_RESUMED':
        this.ws.setSessionId(msg.sessionId);
        this.store.hydrate(msg.snapshot);
        this.emitUI({ type: 'SESSION_RESUMED', sessionId: msg.sessionId });
        this.applyResumedState(msg);
        break;

      case 'DECISION_CREATED':
        this.store.addDecision({
          nodeId: msg.nodeId,
          question: msg.question,
          options: msg.options,
          recommendation: msg.recommendation,
          round: msg.round,
        });
        this.gateOpen = false;
        this.gateWaiting = false;
        this.gateSubmitted = false;
        this.elevator?.setFrame(0);
        this.elevatorAnimating = false;
        this.emitUI({ type: 'ELEVATOR_CLOSED' });

        // The player stays in this scene and the decision doors are replaced.
        this.activateDecision(msg);
        break;

      case 'CHALLENGE':
        this.store.updateCurrent({ challenge: msg.question });
        this.phase = GamePhase.RESPONDING_TO_CHALLENGE;
        this.player.stop();
        this.emitUI({ type: 'CHALLENGE', question: msg.question });
        break;

      case 'EVALUATION':
        this.store.updateCurrent({ feedback: msg.feedback, consequence: msg.consequence });
        this.phase = GamePhase.SHOWING_EVALUATION;
        this.player.stop();
        this.emitUI({
          type: 'EVALUATION',
          feedback: msg.feedback,
          consequence: msg.consequence,
        });
        break;

      case 'SESSION_COMPLETE':
        this.store.complete(msg.summary, msg.docContent);
        this.player.stop();
        this.scene.start('TrophyScene', { store: this.store });
        break;

      case 'ERROR':
        this.gateSubmitted = false;
        this.gateWaiting = false;
        this.emitUI({ type: 'ERROR', message: msg.message });
        break;
    }
  }

  private applyResumedState(msg: SessionResumedMsg): void {
    if (msg.snapshot.phase === 'complete') {
      this.scene.start('TrophyScene', { store: this.store });
      return;
    }

    const current = this.store.getCurrentDecision();
    if (current) {
      this.activateDecision({
        nodeId: current.nodeId,
        question: current.question,
        options: current.options,
        recommendation: current.recommendation,
        round: current.round,
      }, true);
      return;
    }

    this.setZone('common-room');

    if (msg.snapshot.phase === 'awaiting_question') {
      this.openGateWaiting();
      this.phase = GamePhase.WAITING_FOR_QUESTION;
      return;
    }

    this.phase = GamePhase.MENU;
  }

  shutdown(): void {
    this.unsubscribeWs?.();
    this.unsubscribeWs = undefined;
    this.clearDecision();
    this.player?.stop();
    this.emitUI({ type: 'ELEVATOR_PROXIMITY', visible: false });
    this.emitUI({ type: 'DOOR_PROXIMITY', visible: false });
  }
}
