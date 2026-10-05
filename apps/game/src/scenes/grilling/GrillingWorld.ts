import Phaser from 'phaser';
import {
  DECISION_TILEMAP_KEY,
  DECISION_TILESETS,
  DECISION_MAP_TILE_SIZE,
  DECISION_TILE_LAYERS,
  DECISION_COLLIDABLE_LAYER,
  DECISION_MAP_BOUNDS,
} from '../../tilemaps/decisionRoomTilemap';
import {
  CORRIDOR_TILEMAP_KEY,
  CORRIDOR_TILESETS,
  CORRIDOR_TILE_LAYERS,
  CORRIDOR_COLLIDABLE_LAYER,
  CORRIDOR_MAP_TILE_SIZE,
  CORRIDOR_MAP_BOUNDS,
  CORRIDOR_MARKERS,
  patchCorridorTilesets,
} from '../../tilemaps/corridorTilemap';
import {
  OPTION_ROOM_TILEMAP_KEYS,
  OPTION_ROOM_TILE_LAYERS,
  OPTION_ROOM_COLLIDABLE_LAYER,
  OPTION_ROOM_TILESETS,
  OPTION_ROOM_TILE_SIZE,
  OPTION_ROOM_BOUNDS,
  OPTION_ROOM_MARKERS,
} from '../../tilemaps/optionRoomTilemap';
import type { TilesetDef } from '../../tilemaps/patchTilesets';
import { addTileLayers, loadTilemap, type CreatedTilemapLayer } from '../support/tilemap';
import { mapOriginPx, mapSizePx, markerCenter, openMarkerCollision, type Marker } from './geometry';
import { destroySegment, INITIAL_ROOM_ID, type DoorObject, type WorldSegment } from './segment';

type CorridorTiledObject = Phaser.Types.Tilemaps.TiledObject & {
  class?: string;
};

const WORLD_BOUNDS_PADDING = 32;
const DEPTH = {
  decisionRoom: 0,
  corridor: 10,
  optionRoom: 20,
} as const;

export class GrillingWorld {
  private readonly segments = new Map<string, WorldSegment>();
  private bounds?: Phaser.Geom.Rectangle;
  private optionRoomIndex = 0;
  activeRoom?: WorldSegment;
  activeCorridor?: WorldSegment;

  constructor(
    private readonly scene: Phaser.Scene,
    private playerSprite: Phaser.Physics.Arcade.Sprite,
  ) {}

  setPlayer(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.playerSprite = sprite;
  }

  get isEmpty(): boolean {
    return this.segments.size === 0;
  }

  get initialRoom(): WorldSegment | undefined {
    return this.segments.get(INITIAL_ROOM_ID);
  }

  buildDecisionRoom(): WorldSegment {
    const { map, tilesets } = this.loadSegment(
      DECISION_TILEMAP_KEY,
      DECISION_TILESETS,
      DECISION_MAP_TILE_SIZE,
    );
    const { layers, colliders } = this.addLayers({
      layerNames: DECISION_TILE_LAYERS,
      collidableLayer: DECISION_COLLIDABLE_LAYER,
      depthOffset: DEPTH.decisionRoom,
      create: (layerName) => map.createLayer(layerName, tilesets),
    });
    const origin = mapOriginPx(DECISION_MAP_BOUNDS, DECISION_MAP_TILE_SIZE);
    const size = mapSizePx(DECISION_MAP_BOUNDS, DECISION_MAP_TILE_SIZE);
    const segment = this.register({
      id: INITIAL_ROOM_ID,
      ...origin,
      ...size,
      layers,
      colliders,
    });
    this.activeRoom = segment;
    return segment;
  }

  createCorridor(door: DoorObject): WorldSegment {
    const { map, tilesets } = this.loadSegment(
      CORRIDOR_TILEMAP_KEY,
      CORRIDOR_TILESETS,
      CORRIDOR_MAP_TILE_SIZE,
      patchCorridorTilesets,
    );
    const entrance = markerCenter(
      CORRIDOR_MARKERS.entrance,
      CORRIDOR_MAP_BOUNDS,
      CORRIDOR_MAP_TILE_SIZE,
    );
    const x = door.x - entrance.x;
    const y = door.y - entrance.y - 57;
    const mapOrigin = mapOriginPx(CORRIDOR_MAP_BOUNDS, CORRIDOR_MAP_TILE_SIZE);
    const { layers, colliders } = this.addLayers({
      layerNames: CORRIDOR_TILE_LAYERS,
      collidableLayer: CORRIDOR_COLLIDABLE_LAYER,
      depthOffset: DEPTH.corridor,
      create: (layerName) => map.createLayer(layerName, tilesets),
      position: (layer) => {
        layer.setPosition(layer.x + x - mapOrigin.x, layer.y + y - mapOrigin.y);
      },
    });
    const corridor = this.register({
      id: `corridor-${this.segments.size}`,
      x,
      y,
      ...mapSizePx(CORRIDOR_MAP_BOUNDS, CORRIDOR_MAP_TILE_SIZE),
      layers,
      colliders,
    });
    this.lockCorridorExit(corridor);
    this.addCorridorInteractables(corridor, map);
    this.activeCorridor = corridor;
    this.openCorridorMarker(corridor, CORRIDOR_MARKERS.entrance);
    return corridor;
  }

  buildOptionRoom(corridor: WorldSegment): WorldSegment {
    const roomKey =
      OPTION_ROOM_TILEMAP_KEYS[this.optionRoomIndex % OPTION_ROOM_TILEMAP_KEYS.length];
    this.optionRoomIndex += 1;
    const { map, tilesets } = this.loadSegment(
      roomKey,
      OPTION_ROOM_TILESETS,
      OPTION_ROOM_TILE_SIZE,
    );
    const corridorExit = markerCenter(
      CORRIDOR_MARKERS.roomExit,
      CORRIDOR_MAP_BOUNDS,
      CORRIDOR_MAP_TILE_SIZE,
    );
    const roomEntrance = markerCenter(
      OPTION_ROOM_MARKERS.corridorEntrance,
      OPTION_ROOM_BOUNDS,
      OPTION_ROOM_TILE_SIZE,
    );
    const corridorOrigin = mapOriginPx(CORRIDOR_MAP_BOUNDS, CORRIDOR_MAP_TILE_SIZE);
    const roomOrigin = mapOriginPx(OPTION_ROOM_BOUNDS, OPTION_ROOM_TILE_SIZE);
    const x = corridor.x + corridorExit.x - roomEntrance.x;
    const corridorExitTop = CORRIDOR_MARKERS.roomExit.y - corridorOrigin.y;
    const roomEntranceBottom =
      OPTION_ROOM_MARKERS.corridorEntrance.y +
      OPTION_ROOM_MARKERS.corridorEntrance.height -
      roomOrigin.y;
    const y = corridor.y + corridorExitTop - roomEntranceBottom + 45;
    const { layers, colliders } = this.addLayers({
      layerNames: OPTION_ROOM_TILE_LAYERS,
      collidableLayer: OPTION_ROOM_COLLIDABLE_LAYER,
      depthOffset: DEPTH.optionRoom,
      create: (layerName) => map.createLayer(layerName, tilesets),
      position: (layer) => {
        layer.setPosition(layer.x + x - roomOrigin.x, layer.y + y - roomOrigin.y);
      },
    });
    const room = this.register({
      id: `option-room-${this.optionRoomIndex}`,
      x,
      y,
      ...mapSizePx(OPTION_ROOM_BOUNDS, OPTION_ROOM_TILE_SIZE),
      layers,
      colliders,
    });
    this.openCorridorMarker(corridor, CORRIDOR_MARKERS.roomExit);
    openMarkerCollision(
      room,
      OPTION_ROOM_COLLIDABLE_LAYER,
      OPTION_ROOM_MARKERS.corridorEntrance,
      OPTION_ROOM_TILE_SIZE,
    );
    this.activeRoom = room;
    this.activeCorridor = undefined;
    return room;
  }

  lockCorridorExit(corridor: WorldSegment): void {
    if (corridor.exitBlocker) {
      const body = corridor.exitBlocker.body as Phaser.Physics.Arcade.StaticBody | undefined;
  
      if (body) {
        body.enable = true;
      }
  
      return;
    }
  
    const marker = CORRIDOR_MARKERS.roomExit;
    const center = markerCenter(
      marker,
      CORRIDOR_MAP_BOUNDS,
      CORRIDOR_MAP_TILE_SIZE,
    );
  
    const blocker = this.scene.add.rectangle(
      corridor.x + center.x,
      corridor.y + center.y,
      Math.max(marker.width + 12, 56),
      Math.max(marker.height + 12, 70),
      0x000000,
      0,
    );
  
    this.scene.physics.add.existing(blocker, true);
  
    const collider = this.scene.physics.add.collider(
      this.playerSprite,
      blocker,
    );
    
    corridor.exitBlocker = blocker;
    corridor.exitCollider = collider;
    
    corridor.objects.push(blocker);
    corridor.colliders.push(collider);
  }
  
  unlockCorridorExit(corridor: WorldSegment): void {
    if (!corridor.exitBlocker) {
      return;
    }
  
    const body = corridor.exitBlocker.body as Phaser.Physics.Arcade.StaticBody | undefined;
  
    if (body) {
      body.enable = false;
    }
  }

  destroyAll(): void {
    this.segments.forEach(destroySegment);
    this.segments.clear();
    this.activeRoom = undefined;
    this.activeCorridor = undefined;
    this.bounds = undefined;
    this.optionRoomIndex = 0;
  }

  private addCorridorInteractables(
    corridor: WorldSegment,
    map: Phaser.Tilemaps.Tilemap,
  ): void {
    const layer =
      map.objects.find((objectLayer) => objectLayer.name === 'interactables') ??
      map.objects.find((objectLayer) => objectLayer.name === 'markers');

    if (!layer) {
      return;
    }

    const origin = mapOriginPx(CORRIDOR_MAP_BOUNDS, CORRIDOR_MAP_TILE_SIZE);

    for (const object of layer.objects) {
      const tiledObject = object as CorridorTiledObject;
      const objectClass = tiledObject.class ?? tiledObject.type ?? '';
    
      if (objectClass !== 'AIWorkstation' && objectClass !== 'AITerminal') {
        continue;
      }
    
      const type =
        objectClass === 'AIWorkstation'
          ? 'ai-workstation'
          : 'ai-terminal';
    
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const width = Math.max(object.width ?? 1, 1);
      const height = Math.max(object.height ?? 1, 1);
    
      const interactable = this.scene.add.rectangle(
        corridor.x +
          x +
          width / 2 -
          CORRIDOR_MAP_BOUNDS.minTileX * CORRIDOR_MAP_TILE_SIZE,
        corridor.y +
          y +
          height / 2 -
          CORRIDOR_MAP_BOUNDS.minTileY * CORRIDOR_MAP_TILE_SIZE,
        width,
        height,
        0x000000,
        0,
      );
    
      interactable.setData('corridorInteractable', {
        id: object.id,
        type,
        x: interactable.x,
        y: interactable.y,
        width,
        height,
      });
    
      corridor.objects.push(interactable);
    }
  }

  private loadSegment(
    tilemapKey: string,
    tilesetDefs: readonly TilesetDef[],
    tileSize: number,
    patch?: (raw: { tilesets: unknown[] }) => void,
  ): { map: Phaser.Tilemaps.Tilemap; tilesets: Phaser.Tilemaps.Tileset[] } {
    return loadTilemap(this.scene, tilemapKey, tilesetDefs, tileSize, patch);
  }

  private addLayers(options: {
    layerNames: readonly string[];
    collidableLayer: string;
    depthOffset: number;
    create: (layerName: string) => CreatedTilemapLayer | null;
    position?: (layer: CreatedTilemapLayer) => void;
  }): {
    layers: CreatedTilemapLayer[];
    colliders: Phaser.Physics.Arcade.Collider[];
  } {
    return addTileLayers(this.scene, {
      ...options,
      collideWith: this.playerSprite,
    });
  }

  private openCorridorMarker(corridor: WorldSegment, marker: Marker): void {
    openMarkerCollision(corridor, CORRIDOR_COLLIDABLE_LAYER, marker, CORRIDOR_MAP_TILE_SIZE);
  }

  private register(segment: Omit<WorldSegment, 'objects' | 'doors'>): WorldSegment {
    const full: WorldSegment = {
      ...segment,
      objects: [],
      doors: [],
    };
    this.segments.set(full.id, full);
    this.extendBounds(full);
    return full;
  }

  private extendBounds(segment: WorldSegment): void {
    const next = new Phaser.Geom.Rectangle(segment.x, segment.y, segment.width, segment.height);

    if (!this.bounds) {
      this.bounds = next;
    } else {
      Phaser.Geom.Rectangle.MergeRect(this.bounds, next);
    }

    this.scene.physics.world.setBounds(
      this.bounds.x - WORLD_BOUNDS_PADDING,
      this.bounds.y - WORLD_BOUNDS_PADDING,
      this.bounds.width + WORLD_BOUNDS_PADDING * 2,
      this.bounds.height + WORLD_BOUNDS_PADDING * 2,
    );
  }
}
