import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSET_ROOT = resolve(__dirname, '../public/assets');
const EXPECTED_IMAGE_PATHS = new Set([
  'map/FloorAndGround.png',
  'items/Modern_Office_Black_Shadow.png',
  'items/Generic.png',
  'items/Basement.png',
]);

const MAPS = [
  'map/corridor/corridor.json',
  'map/randomrooms/room-1.json',
  'map/randomrooms/room-2.json',
  'map/randomrooms/room-3.json',
  'map/randomrooms/room-4.json',
] as const;

const EXPECTED_TILESETS = [
  {
    firstgid: 1,
    name: 'FloorAndGround16',
    image: 'FloorAndGround.png',
    columns: 128,
    tilecount: 10240,
    tilewidth: 16,
    tileheight: 16,
  },
  {
    firstgid: 10241,
    name: 'ModernOfficeBlackShadow16',
    image: 'Modern_Office_Black_Shadow.png',
    columns: 32,
    tilecount: 3392,
    tilewidth: 16,
    tileheight: 16,
  },
  {
    firstgid: 13633,
    name: 'FloorAndGround16B',
    image: 'FloorAndGround.png',
    columns: 128,
    tilecount: 10240,
    tilewidth: 16,
    tileheight: 16,
  },
  {
    firstgid: 23873,
    name: 'Generic16',
    image: 'Generic.png',
    columns: 32,
    tilecount: 4992,
    tilewidth: 16,
    tileheight: 16,
  },
  {
    firstgid: 28865,
    name: 'Basement16',
    image: 'Basement.png',
    columns: 32,
    tilecount: 3200,
    tilewidth: 16,
    tileheight: 16,
  },
] as const;

function readMap(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(ASSET_ROOT, path), 'utf8')) as Record<string, unknown>;
}

describe('Tiled map assets', () => {
  it('contains no editor-machine-specific paths', () => {
    for (const mapPath of MAPS) {
      const raw = readFileSync(resolve(ASSET_ROOT, mapPath), 'utf8');

      expect(raw).not.toMatch(/(?:Downloads|AppData|Users|home|mnt)[\\/]/i);
      expect(raw).not.toContain('\\\\');
    }
  });

  it('embeds the expected portable tilesets for every continuous-world map', () => {
    for (const mapPath of MAPS) {
      const map = readMap(mapPath);
      const tilesets = map.tilesets;

      expect(Array.isArray(tilesets)).toBe(true);
      expect(tilesets).toHaveLength(EXPECTED_TILESETS.length);

      expect(tilesets).toEqual(
        EXPECTED_TILESETS.map((tileset) => ({
          ...tileset,
          imageheight:
            tileset.name === 'Generic16'
              ? 2496
              : tileset.name === 'Basement16'
                ? 1600
                : tileset.name === 'ModernOfficeBlackShadow16'
                  ? 1696
                  : 1280,
          imagewidth:
            tileset.name === 'Generic16'
              ? 512
              : tileset.name === 'Basement16'
                ? 512
                : tileset.name === 'ModernOfficeBlackShadow16'
                  ? 512
                  : 2048,
          margin: 0,
          spacing: 0,
        })),
      );

      for (const tileset of tilesets as Array<Record<string, unknown>>) {
        expect(tileset.source).toBeUndefined();
        expect(typeof tileset.image).toBe('string');
        const image = tileset.image as string;
        const imagePath = image === 'FloorAndGround.png' ? 'map/FloorAndGround.png' : `items/${image}`;

        expect(EXPECTED_IMAGE_PATHS.has(imagePath)).toBe(true);
        expect(() => readFileSync(resolve(ASSET_ROOT, imagePath))).not.toThrow();
      }
    }
  });
});
