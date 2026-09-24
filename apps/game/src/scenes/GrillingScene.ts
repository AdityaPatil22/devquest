import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { GamePhase } from '../state/GameState';
import { SessionStore } from '../state/SessionStore';
import { WebSocketClient } from '../net/WebSocketClient';

import {
  DECISION_TILEMAP_KEY,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  DECISION_TILE_LAYERS,
  DECISION_COLLIDABLE_LAYER,
  DECISION_MAP_BOUNDS,
  DECISION_SPAWN_TILE,
  DECISION_DOOR_ROW_TILE_Y,
  DECISION_DOOR_ROW_X_RANGE,
  patchDecisionRoomTilesets,
} from '../tilemaps/decisionRoomTilemap';

import {
  CORRIDOR_TILEMAP_KEY,
  CORRIDOR_TILESETS,
  CORRIDOR_TILE_LAYERS,
  CORRIDOR_COLLIDABLE_LAYER,
  CORRIDOR_MAP_TILE_SIZE,
  CORRIDOR_MAP_BOUNDS,
  patchCorridorTilesets,
} from '../tilemaps/corridorTilemap';

import {
  OPTION_ROOM_TILEMAP_KEYS,
  OPTION_ROOM_TILE_LAYERS,
  OPTION_ROOM_COLLIDABLE_LAYER,
  OPTION_ROOM_WIDTH_PX,
  OPTION_ROOM_HEIGHT_PX,
  OPTION_ROOM_BOUNDS,
  OPTION_ROOM_TILESETS,
  patchOptionRoomTilesets,
} from '../tilemaps/optionRoomTilemap';

import type {
  ServerMessage,
  DecisionCreatedMsg,
  ChallengeMsg,
  EvaluationMsg,
  SessionCompleteMsg,
  DecisionOption,
} from '../net/protocol';

import { emitUIEvent } from '../game/GameBridge';

interface DoorObject {
  option: DecisionOption;
  x: number;
  y: number;
  doorSprite: Phaser.GameObjects.Image;
  isRecommended: boolean;
  isOpen: boolean;
}

interface SceneData {
  ws: WebSocketClient;
  store: SessionStore;
  decision: DecisionCreatedMsg;
  restored?: boolean;
  devMode?: boolean;
}

type CreatedTilemapLayer = NonNullable<ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>>;

interface WorldSegment {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layers: CreatedTilemapLayer[];
  objects: Phaser.GameObjects.Image[];
  colliders: Phaser.Physics.Arcade.Collider[];
}

const DOOR_SCALE = 0.191;
const DOOR_OPEN_SCALE = 0.191;
const OPTION_ROOM_1_KEY = OPTION_ROOM_TILEMAP_KEYS[0];

const OPTION_ROOM_SHIFT_X_PX = 200;
const OPTION_ROOM_OVERLAP_Y_PX = 20;

const CORRIDOR_ENTRANCE_MIN_TILE_X = 5;
const CORRIDOR_ENTRANCE_MAX_TILE_X = 8;
const CORRIDOR_ENTRANCE_TILE_Y = 12;

export class GrillingScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private ws!: WebSocketClient;
  private store!: SessionStore;
  private map!: Phaser.Tilemaps.Tilemap;
  private wallsLayer?: ReturnType<Phaser.Tilemaps.Tilemap['createLayer']>;
  private doors: DoorObject[] = [];
  private phase = GamePhase.EXPLORING_DOORS;
  private currentDoor?: DoorObject;
  private currentNodeId = '';
  private unsubscribeWs?: () => void;
  private devMode = false;
  private worldBottomY = 0;
  private decisionRoomOffsetY = 0;
  private segments = new Map<string, WorldSegment>();
  private decisionSegment?: WorldSegment;
  private corridorSegment?: WorldSegment;
  private optionRoomSegment?: WorldSegment;
  private corridorEntryTrigger?: Phaser.GameObjects.Zone;
  private corridorContextShown = false;
  constructor() {
    super({
      key: 'GrillingScene',
    });
  }

  // Phaser Assets
  preload(): void {
    this.load.image('door-closed', 'assets/items/door-closed.png');
    this.load.image('door-open', 'assets/items/door-open.png');
  }

  // ---------------------------------------------------------------------------
  // Scene Initialization
  // ---------------------------------------------------------------------------

  init(data: SceneData): void {
    this.ws = data.ws;
    this.store = data.store;
    this.devMode = data.devMode ?? false;
    this.phase = GamePhase.EXPLORING_DOORS;
    this.currentDoor = undefined;
    this.doors = [];
    this.currentNodeId = data.decision.nodeId;
    this.data.set('decision', data.decision);
    this.data.set('restored', data.restored ?? false);
    this.unsubscribeWs = this.ws.onMessage(this.handleMessage.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Scene creation
  // ---------------------------------------------------------------------------

  create(): void {
    this.createPlayer();
    this.setupInput();
    
    const decision = this.data.get('decision') as DecisionCreatedMsg;
    this.buildInitialWorld(decision);
    
    const restored = this.data.get('restored') as boolean;
    if (restored) {
      this.restoreCurrentPhase();
    }

    this.emitUI({
      type: 'DECISION_ROOM_READY',
    });
  }

  // ---------------------------------------------------------------------------
  // Phaser game loop
  // ---------------------------------------------------------------------------

  update(): void {
    if (this.phase === GamePhase.EXPLORING_DOORS || this.phase === GamePhase.TRAVERSING_OPTION) {
      this.player.handleMovement(this.cursors);
      if (this.phase === GamePhase.EXPLORING_DOORS) {
        this.checkDoorProximity();
      }
    } else {
      this.player.stop();
    }
  }

  // ---------------------------------------------------------------------------
  // Initial continuous world
  // ---------------------------------------------------------------------------

  private buildInitialWorld(decision: DecisionCreatedMsg): void {
    this.buildRoom();
    this.renderDecision(decision);
    const initialDoor = this.doors[0];
    if (!initialDoor) {
      console.error('[GrillingScene] Cannot build initial branch: no decision doors exist.');
      return;
    }
    this.createCorridor(initialDoor);
  }

  // ---------------------------------------------------------------------------
  // Continuous branch
  // ---------------------------------------------------------------------------

  private createCorridor(door: DoorObject): void {
    this.removeSegment('option-room-1');
    this.removeSegment('corridor');
    const corridor = this.createCorridorAt(door);
    this.buildRoom1FromCorridor(corridor);
  }

  private createCorridorAt(door: DoorObject): WorldSegment {
    const cached = this.cache.tilemap.get(CORRIDOR_TILEMAP_KEY);
    if (cached?.data) {
      patchCorridorTilesets(cached.data);
    }

    const map = this.make.tilemap({
      key: CORRIDOR_TILEMAP_KEY,
    });

    const tilesets = CORRIDOR_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    const width =
      (CORRIDOR_MAP_BOUNDS.maxTileX - CORRIDOR_MAP_BOUNDS.minTileX + 1) * CORRIDOR_MAP_TILE_SIZE;

    const height =
      (CORRIDOR_MAP_BOUNDS.maxTileY - CORRIDOR_MAP_BOUNDS.minTileY + 1) * CORRIDOR_MAP_TILE_SIZE;

    const corridorEntranceCenterTileX =
      (CORRIDOR_ENTRANCE_MIN_TILE_X + CORRIDOR_ENTRANCE_MAX_TILE_X + 1) / 2;

    const corridorEntranceCenterOffsetX =
      (corridorEntranceCenterTileX - CORRIDOR_MAP_BOUNDS.minTileX) * CORRIDOR_MAP_TILE_SIZE;

    const corridorEntranceCenterOffsetY =
      (CORRIDOR_ENTRANCE_TILE_Y - CORRIDOR_MAP_BOUNDS.minTileY + 0.5) * CORRIDOR_MAP_TILE_SIZE;

    const segmentX = door.x - corridorEntranceCenterOffsetX;
    const segmentY = door.y - corridorEntranceCenterOffsetY - 50;

    const layerX = segmentX - CORRIDOR_MAP_BOUNDS.minTileX * CORRIDOR_MAP_TILE_SIZE;
    const layerY = segmentY - CORRIDOR_MAP_BOUNDS.minTileY * CORRIDOR_MAP_TILE_SIZE;

    const layers: CreatedTilemapLayer[] = [];
    const colliders: Phaser.Physics.Arcade.Collider[] = [];

    CORRIDOR_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = map.createLayer(layerName, tilesets, layerX, layerY);

      if (!layer) {
        console.error(`[GrillingScene] Failed to create corridor layer: ${layerName}`);
        return;
      }

      layer.setDepth(depth + 10);

      layers.push(layer);

      if (layerName === CORRIDOR_COLLIDABLE_LAYER) {
        layer.setCollisionByExclusion([-1]);

        // The corridor interior must remain walkable.
        // Only the outer wall tiles should block the player.
        for (let y = CORRIDOR_MAP_BOUNDS.minTileY; y <= CORRIDOR_MAP_BOUNDS.maxTileY; y++) {
          for (let x = CORRIDOR_MAP_BOUNDS.minTileX; x <= CORRIDOR_MAP_BOUNDS.maxTileX; x++) {
            const tile = layer.getTileAt(x, y, true);

            if (!tile) {
              continue;
            }

            const isOuterWall =
              x === CORRIDOR_MAP_BOUNDS.minTileX ||
              x === CORRIDOR_MAP_BOUNDS.maxTileX ||
              y === CORRIDOR_MAP_BOUNDS.minTileY ||
              y === CORRIDOR_MAP_BOUNDS.maxTileY;

            tile.setCollision(isOuterWall);
          }
        }

        colliders.push(this.physics.add.collider(this.player.sprite, layer));
      }
    });

    const segment: WorldSegment = {
      id: 'corridor',
      x: segmentX,
      y: segmentY,
      width,
      height,
      layers,
      objects: [],
      colliders,
    };

    this.corridorSegment = segment;

    this.segments.set(segment.id, segment);

    this.extendWorldBounds(segmentX, segmentY, segmentX + width, segmentY + height);

    return segment;
  }

  private buildRoom1FromCorridor(corridor: WorldSegment): void {
    const cached = this.cache.tilemap.get(OPTION_ROOM_1_KEY);
    if (cached?.data) {
      patchOptionRoomTilesets(cached.data);
    }
    const map = this.make.tilemap({
      key: OPTION_ROOM_1_KEY,
    });

    const tilesets = OPTION_ROOM_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    const width = OPTION_ROOM_WIDTH_PX;
    const height = OPTION_ROOM_HEIGHT_PX;

    const roomX = corridor.x + OPTION_ROOM_SHIFT_X_PX;
    const roomY = corridor.y - height + OPTION_ROOM_OVERLAP_Y_PX;

    const layerX = roomX - OPTION_ROOM_BOUNDS.minTileX * DECISION_MAP_TILE_SIZE;
    const layerY = roomY - OPTION_ROOM_BOUNDS.minTileY * DECISION_MAP_TILE_SIZE;

    const layers: CreatedTilemapLayer[] = [];
    const colliders: Phaser.Physics.Arcade.Collider[] = [];

    OPTION_ROOM_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = map.createLayer(layerName, tilesets, layerX, layerY);
      if (!layer) {
        console.error(`[GrillingScene] Failed to create Room-1 layer: ${layerName}`);
        return;
      }
      layer.setDepth(depth + 20);
      layers.push(layer);
      if (layerName === OPTION_ROOM_COLLIDABLE_LAYER) {
        layer.setCollisionByExclusion([-1]);
        colliders.push(this.physics.add.collider(this.player.sprite, layer));
      }
    });

    const segment: WorldSegment = {
      id: 'option-room-1',
      x: roomX,
      y: roomY,
      width,
      height,
      layers,
      objects: [],
      colliders,
    };

    this.optionRoomSegment = segment;
    this.segments.set(segment.id, segment);
    this.extendWorldBounds(roomX, roomY, roomX + width, roomY + height);
  }

  private createCorridorEntryTrigger(door: DoorObject): void {
    this.corridorEntryTrigger?.destroy();
    this.corridorContextShown = false;
    const trigger = this.add.zone(door.x, door.y - 48, 32, 32);
    this.physics.add.existing(trigger, true);
    this.corridorEntryTrigger = trigger;
    this.physics.add.overlap(this.player.sprite, trigger, () => {
      if (this.corridorContextShown || !this.currentDoor) {
        return;
      }
      this.corridorContextShown = true;
      this.phase = GamePhase.DOOR_CONTEXT;
      this.player.stop();
      this.emitUI({
        type: 'DOOR_CONTEXT',
        visible: true,
        option: this.currentDoor.option,
      });
    });
  }

  private removeSegment(id: string): void {
    const segment = this.segments.get(id);
    if (!segment) {
      return;
    }

    segment.colliders.forEach((collider) => {
      collider.destroy();
    });

    segment.objects.forEach((object) => {
      object.destroy();
    });

    segment.layers.forEach((layer) => {
      layer.destroy();
    });

    this.segments.delete(id);

    if (segment === this.corridorSegment) {
      this.corridorSegment = undefined;
    }

    if (segment === this.optionRoomSegment) {
      this.optionRoomSegment = undefined;
    }
  }

  private extendWorldBounds(left: number, top: number, right: number, bottom: number): void {
    const currentBounds = this.physics.world.bounds;
    const padding = 512;
    const minX = Math.min(currentBounds.x, left - padding);
    const minY = Math.min(currentBounds.y, top - padding);
    const maxX = Math.max(currentBounds.right, right + padding);
    const maxY = Math.max(currentBounds.bottom, bottom + padding);
    this.physics.world.setBounds(minX, minY, maxX - minX, maxY - minY);
  }

  // ---------------------------------------------------------------------------
  // Build a decision room at an arbitrary Y offset
  // ---------------------------------------------------------------------------

  private buildDecisionRoomAt(offsetY: number): void {
    const cached = this.cache.tilemap.get(DECISION_TILEMAP_KEY);

    if (cached?.data) {
      patchDecisionRoomTilesets(cached.data);
    }

    const map = this.make.tilemap({
      key: DECISION_TILEMAP_KEY,
    });

    const tilesets = DECISION_TILESETS.map((tileset) =>
      map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    const layers: CreatedTilemapLayer[] = [];

    const colliders: Phaser.Physics.Arcade.Collider[] = [];

    DECISION_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = map.createLayer(layerName, tilesets, 0, offsetY);

      if (!layer) {
        return;
      }

      layer.setDepth(depth);

      layers.push(layer);

      if (layerName === DECISION_COLLIDABLE_LAYER) {
        layer.setCollisionByExclusion([-1]);

        colliders.push(this.physics.add.collider(this.player.sprite, layer));
      }
    });

    const width =
      (DECISION_MAP_BOUNDS.maxTileX - DECISION_MAP_BOUNDS.minTileX + 1) * DECISION_MAP_TILE_SIZE;

    const height =
      (DECISION_MAP_BOUNDS.maxTileY - DECISION_MAP_BOUNDS.minTileY + 1) * DECISION_MAP_TILE_SIZE;

    const segment: WorldSegment = {
      id: `decision-${offsetY}`,
      x: 0,
      y: offsetY,
      width,
      height,
      layers,
      objects: [],
      colliders,
    };

    this.segments.set(segment.id, segment);
  }

  // ---------------------------------------------------------------------------
  // React communication
  // ---------------------------------------------------------------------------

  private emitUI(event: Parameters<typeof emitUIEvent>[1]): void {
    emitUIEvent(this.game, event);
  }

  // ---------------------------------------------------------------------------
  // Restore state after reload
  // ---------------------------------------------------------------------------

  private restoreCurrentPhase(): void {
    const decision = this.store.getCurrentDecision();
    if (!decision) {
      return;
    }
    this.phase = GamePhase.EXPLORING_DOORS;
    this.emitUI({
      type: 'EXPLORING_DOORS',
    });
  }

  // ---------------------------------------------------------------------------
  // Room building
  // ---------------------------------------------------------------------------

  private buildRoom(): void {
    const cached = this.cache.tilemap.get(DECISION_TILEMAP_KEY);

    if (cached?.data) {
      patchDecisionRoomTilesets(cached.data);
    }

    this.map = this.make.tilemap({
      key: DECISION_TILEMAP_KEY,
    });

    const tilesets = DECISION_TILESETS.map((tileset) =>
      this.map.addTilesetImage(tileset.name, tileset.key),
    ).filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

    const layers: CreatedTilemapLayer[] = [];

    const colliders: Phaser.Physics.Arcade.Collider[] = [];

    DECISION_TILE_LAYERS.forEach((layerName, depth) => {
      const layer = this.map.createLayer(layerName, tilesets);

      if (!layer) {
        return;
      }

      layer.setDepth(depth);

      layers.push(layer);

      if (layerName === DECISION_COLLIDABLE_LAYER) {
        layer.setCollisionByExclusion([-1]);

        colliders.push(this.physics.add.collider(this.player.sprite, layer));

        this.wallsLayer = layer;
      }
    });

    const { minTileX, maxTileX, minTileY, maxTileY } = DECISION_MAP_BOUNDS;

    const boundsX = minTileX * DECISION_MAP_TILE_SIZE;

    const boundsY = minTileY * DECISION_MAP_TILE_SIZE;

    const boundsWidthPx = (maxTileX - minTileX + 1) * DECISION_MAP_TILE_SIZE;

    const boundsHeightPx = (maxTileY - minTileY + 1) * DECISION_MAP_TILE_SIZE;

    this.physics.world.setBounds(boundsX, boundsY, boundsWidthPx, boundsHeightPx);

    this.decisionRoomOffsetY = boundsY;

    this.worldBottomY = boundsY + boundsHeightPx;

    const segment: WorldSegment = {
      id: 'decision-room',
      x: 0,
      y: boundsY,
      width: boundsWidthPx,
      height: boundsHeightPx,
      layers,
      objects: [],
      colliders,
    };

    this.decisionSegment = segment;

    this.segments.set(segment.id, segment);
  }

  private openDoorwayCollision(door: DoorObject): void {
    if (!this.wallsLayer) {
      return;
    }

    const doorTileX = Math.floor(door.x / DECISION_MAP_TILE_SIZE);
    const doorTileY = Math.floor(door.y / DECISION_MAP_TILE_SIZE);

    let wallStartY: number | undefined;

    for (let y = doorTileY - 1; y >= DECISION_MAP_BOUNDS.minTileY; y -= 1) {
      const tile = this.wallsLayer.getTileAt(doorTileX, y, true);

      if (tile && tile.index !== -1) {
        wallStartY = y;
        break;
      }
    }

    if (wallStartY === undefined) {
      console.warn('[GrillingScene] Could not find wall above door');
      return;
    }

    for (let x = doorTileX - 1; x <= doorTileX + 1; x += 1) {
      for (let y = wallStartY; y >= DECISION_MAP_BOUNDS.minTileY; y -= 1) {
        const tile = this.wallsLayer.getTileAt(x, y, true);

        if (!tile || tile.index === -1) {
          continue;
        }

        tile.setCollision(false);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Decision rendering
  // ---------------------------------------------------------------------------

  private renderDecision(decision: DecisionCreatedMsg): void {
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

    const options = decision.options;
    const rangeStartPx = DECISION_DOOR_ROW_X_RANGE.minTileX * DECISION_MAP_TILE_SIZE;
    const rangeWidthPx =
      (DECISION_DOOR_ROW_X_RANGE.maxTileX - DECISION_DOOR_ROW_X_RANGE.minTileX + 1) *
      DECISION_MAP_TILE_SIZE;
    const spacing = options.length > 0 ? Math.min(120, rangeWidthPx / (options.length + 1)) : 120;
    const doorY =
      this.decisionRoomOffsetY +
      DECISION_DOOR_ROW_TILE_Y * DECISION_MAP_TILE_SIZE +
      DECISION_MAP_TILE_SIZE / 2;

    options.forEach((option, index) => {
      const doorX = rangeStartPx + spacing * (index + 1);
      const isRecommended = decision.recommendation?.option === option.id;
      const doorSprite = this.add
        .image(doorX, doorY, 'door-closed')
        .setOrigin(0.5, 1.42)
        .setDepth(5)
        .setScale(DOOR_SCALE);

      this.doors.push({
        option,
        x: doorX,
        y: doorY,
        doorSprite,
        isRecommended,
        isOpen: false,
      });
      this.decisionSegment?.objects.push(doorSprite);
    });

    this.phase = GamePhase.EXPLORING_DOORS;
    this.emitUI({
      type: 'EXPLORING_DOORS',
    });
  }

  // ---------------------------------------------------------------------------
  // Clear previous decision
  // ---------------------------------------------------------------------------

  private clearDecision(): void {
    this.doors.forEach((door) => {
      door.doorSprite.destroy();
    });

    if (this.decisionSegment) {
      this.decisionSegment.objects = [];
    }

    this.doors = [];
    this.currentDoor = undefined;
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  private createPlayer(): void {
    const spawnX = DECISION_SPAWN_TILE.x * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;
    const spawnY = DECISION_SPAWN_TILE.y * DECISION_MAP_TILE_SIZE + DECISION_MAP_TILE_SIZE / 2;
    this.player = new Player(this, spawnX, spawnY);
    this.player.sprite.setDepth(50);
    this.player.sprite.setCollideWorldBounds(false);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(120, 80);
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  // ---------------------------------------------------------------------------
  // Door proximity
  // ---------------------------------------------------------------------------

  private checkDoorProximity(): void {
    let nearest: DoorObject | null = null;

    let minDist = Infinity;

    for (const door of this.doors) {
      const distance = Phaser.Math.Distance.Between(
        this.player.sprite.x,
        this.player.sprite.y,
        door.x,
        door.y,
      );

      if (distance < 50 && distance < minDist) {
        minDist = distance;

        nearest = door;
      }
    }

    if (nearest && nearest !== this.currentDoor) {
      this.currentDoor = nearest;

      this.showDoorPrompt(nearest);
    } else if (!nearest && this.currentDoor) {
      this.currentDoor = undefined;

      this.hideDoorPrompt();
    }

    if (nearest && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.approachDoor(nearest);
    }
  }

  // ---------------------------------------------------------------------------
  // Door prompt
  // ---------------------------------------------------------------------------

  private showDoorPrompt(door: DoorObject): void {
    door.doorSprite.setTint(0xffaa44);

    this.emitUI({
      type: 'DOOR_PROXIMITY',
      visible: true,
      option: door.option,
    });
  }

  private hideDoorPrompt(): void {
    this.doors.forEach((door) => {
      door.doorSprite.clearTint();
    });

    this.emitUI({
      type: 'DOOR_PROXIMITY',
      visible: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Enter door
  // ---------------------------------------------------------------------------

  private approachDoor(door: DoorObject): void {
    this.currentDoor = door;
    this.phase = GamePhase.TRAVERSING_OPTION;

    this.hideDoorPrompt();

    if (!door.isOpen) {
      door.isOpen = true;

      door.doorSprite.setTexture('door-open').setOrigin(0.5, 1.32).setScale(DOOR_OPEN_SCALE);
    }

    this.openDoorwayCollision(door);
    this.createCorridor(door);
    this.openCorridorEntrance();
    this.createCorridorEntryTrigger(door);
  }

  // ---------------------------------------------------------------------------
  // Select door
  // ---------------------------------------------------------------------------

  public confirmDoorSelection(context?: string): void {
    if (!this.currentDoor) {
      return;
    }

    const door = this.currentDoor;

    this.selectDoor(door, context);
  }

  public cancelDoorSelection(): void {
    if (this.phase !== GamePhase.DOOR_CONTEXT) {
      return;
    }

    if (this.currentDoor) {
      this.currentDoor.isOpen = false;

      this.currentDoor.doorSprite
        .setTexture('door-closed')
        .setOrigin(0.5, 1.42)
        .setScale(DOOR_SCALE);
    }

    this.phase = GamePhase.EXPLORING_DOORS;

    this.currentDoor = undefined;

    this.emitUI({
      type: 'DOOR_CONTEXT',
      visible: false,
    });
  }

  private selectDoor(door: DoorObject, context?: string): void {
    this.phase = GamePhase.TRAVERSING_OPTION;

    this.store.updateCurrent({
      selectedOptionId: door.option.id,
      context,
    });

    this.ws.send({
      type: 'OPTION_SELECTED',
      nodeId: this.currentNodeId,
      optionId: door.option.id,
      context,
    });

    this.emitUI({
      type: 'DOOR_CONTEXT',
      visible: false,
    });

    this.corridorEntryTrigger?.destroy();
    this.corridorEntryTrigger = undefined;
  }

  private openCorridorEntrance(): void {
    if (!this.corridorSegment) {
      return;
    }

    const wallLayer = this.corridorSegment.layers.find(
      (layer) => layer.layer.name === CORRIDOR_COLLIDABLE_LAYER,
    );

    if (!wallLayer) {
      return;
    }

    // Doorway tiles from corridor.json.
    for (let x = 6; x <= 7; x += 1) {
      const tile = wallLayer.getTileAt(x, 11, true);

      tile?.setCollision(false);
    }

    for (let x = 5; x <= 8; x += 1) {
      const tile = wallLayer.getTileAt(x, 12, true);

      tile?.setCollision(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Server messages
  // ---------------------------------------------------------------------------

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'DECISION_CREATED': {
        const decision = msg as DecisionCreatedMsg;

        this.store.addDecision({
          nodeId: decision.nodeId,
          question: decision.question,
          options: decision.options,
          recommendation: decision.recommendation,
          round: decision.round,
        });

        const newRoomOffsetY = this.worldBottomY;

        this.buildDecisionRoomAt(newRoomOffsetY);

        this.decisionRoomOffsetY = newRoomOffsetY;

        const decisionRoomHeightPx =
          (DECISION_MAP_BOUNDS.maxTileY - DECISION_MAP_BOUNDS.minTileY + 1) *
          DECISION_MAP_TILE_SIZE;

        this.worldBottomY += decisionRoomHeightPx;

        const bounds = this.cameras.main.getBounds();

        const newH = Math.max(bounds.height, this.worldBottomY - bounds.y);

        this.physics.world.setBounds(bounds.x, bounds.y, bounds.width, newH);

        this.phase = GamePhase.EXPLORING_DOORS;

        this.emitUI({
          type: 'EXPLORING_DOORS',
        });

        this.time.delayedCall(400, () => {
          this.clearDecision();

          this.renderDecision(decision);
        });

        break;
      }

      case 'SESSION_COMPLETE': {
        const complete = msg as SessionCompleteMsg;

        this.store.complete(complete.summary, complete.docContent);

        this.player.stop();

        this.scene.start('TrophyScene', {
          store: this.store,
        });

        break;
      }

      case 'SESSION_RESUMED': {
        this.emitUI({
          type: 'SESSION_RESUMED',
        });

        break;
      }

      case 'ERROR': {
        console.error('Server error:', msg.message);

        this.emitUI({
          type: 'ERROR',
          message: msg.message,
        });

        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  private leaveBoot(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs = undefined;
  }

  shutdown(): void {
    this.unsubscribeWs?.();

    this.unsubscribeWs = undefined;

    this.segments.forEach((segment) => {
      segment.colliders.forEach((collider) => {
        collider.destroy();
      });

      segment.objects.forEach((object) => {
        object.destroy();
      });

      segment.layers.forEach((layer) => {
        layer.destroy();
      });
    });

    this.segments.clear();

    this.doors = [];

    this.currentDoor = undefined;

    this.decisionSegment = undefined;

    this.corridorSegment = undefined;

    this.optionRoomSegment = undefined;
  }
}
