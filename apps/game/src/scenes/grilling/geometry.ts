/**
 * Tiled coordinates -> world coordinates.
 *
 * Every connection point in the Grilling world (corridor entrance, corridor
 * exit, option-room entrance, each doorway) is authored as a marker object in
 * Tiled rather than hardcoded as a tile row/column. All of them convert the
 * same way, which is what this module exists for:
 *
 *   world = segmentOrigin + markerPos - mapMinTile * tileSize
 *
 * The `- mapMinTile * tileSize` term is what makes infinite/chunked maps with
 * a negative authored origin line up with segments placed at a world position.
 */

import type { CreatedTilemapLayer } from '../support/tilemap';
import { findLayer } from '../support/tilemap';
import type { WorldSegment } from './segment';

/** A Tiled object-layer marker, in map pixel coordinates. */
export interface Marker {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The tile extent a map's authored geometry covers. */
export interface TileBounds {
  minTileX: number;
  maxTileX: number;
  minTileY: number;
  maxTileY: number;
}

export interface Point {
  x: number;
  y: number;
}

export function mapSizePx(bounds: TileBounds, tileSize: number): { width: number; height: number } {
  return {
    width: (bounds.maxTileX - bounds.minTileX + 1) * tileSize,
    height: (bounds.maxTileY - bounds.minTileY + 1) * tileSize,
  };
}

export function mapOriginPx(bounds: TileBounds, tileSize: number): Point {
  return {
    x: bounds.minTileX * tileSize,
    y: bounds.minTileY * tileSize,
  };
}

/** Center of a marker, relative to the origin of the segment that owns it. */
export function markerCenter(marker: Marker, bounds: TileBounds, tileSize: number): Point {
  const origin = mapOriginPx(bounds, tileSize);

  return {
    x: marker.x + marker.width / 2 - origin.x,
    y: marker.y + marker.height / 2 - origin.y,
  };
}

/** Center of a marker in world coordinates. */
export function markerWorldCenter(
  segment: WorldSegment,
  marker: Marker,
  bounds: TileBounds,
  tileSize: number,
): Point {
  const local = markerCenter(marker, bounds, tileSize);

  return {
    x: segment.x + local.x,
    y: segment.y + local.y,
  };
}

/**
 * Clear collision on every tile a marker covers, turning an authored wall
 * section into a usable opening between two segments.
 */
export function openMarkerCollision(
  segment: WorldSegment,
  layerName: string,
  marker: Marker,
  tileSize: number,
): void {
  const wallLayer = findLayer(segment.layers, layerName);

  if (!wallLayer) {
    return;
  }

  const originTileX = Math.round(wallLayer.layer.x / tileSize);
  const originTileY = Math.round(wallLayer.layer.y / tileSize);

  const startX = Math.floor(marker.x / tileSize) - originTileX;
  const endX = Math.ceil((marker.x + marker.width) / tileSize) - 1 - originTileX;
  const startY = Math.floor(marker.y / tileSize) - originTileY;
  const endY = Math.ceil((marker.y + marker.height) / tileSize) - 1 - originTileY;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      wallLayer.getTileAt(x, y, true)?.setCollision(false);
    }
  }
}

/**
 * Walk up from a doorway and clear collision on the wall column above it
 * (plus one tile either side) so the player can pass through.
 */
export function clearVerticalWall(
  layer: CreatedTilemapLayer,
  centerTileX: number,
  startTileY: number,
  minTileY: number,
): void {
  let wallStartY: number | undefined;

  for (let y = startTileY - 1; y >= minTileY; y -= 1) {
    const tile = layer.getTileAt(centerTileX, y, true);

    if (tile && tile.index !== -1) {
      wallStartY = y;

      break;
    }
  }

  if (wallStartY === undefined) {
    return;
  }

  for (let x = centerTileX - 1; x <= centerTileX + 1; x += 1) {
    for (let y = wallStartY; y >= minTileY; y -= 1) {
      const tile = layer.getTileAt(x, y, true);
      if (!tile || tile.index === -1) {
        continue;
      }
      tile.setCollision(false);
    }
  }
}
