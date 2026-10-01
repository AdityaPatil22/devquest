/**
 * Shared Tiled-tileset patching for the maps that embed their tilesets.
 *
 * Tiled writes external `.tsx` references into the exported JSON. Phaser
 * cannot resolve those, so every map's raw JSON gets its `tilesets` array
 * replaced with embedded definitions before `make.tilemap` reads it.
 *
 * The Common Room map is deliberately NOT handled here — it loads its
 * tilesets as spritesheets so `createFromObjects` can address per-tile
 * frames, which is a different shape entirely.
 */

export interface TilesetDef {
  /** Must match the tileset "name" inside the map JSON */
  name: string;
  /** Phaser texture key the image is loaded under */
  key: string;
  /** Path relative to /public */
  path: string;
  firstgid: number;
  columns: number;
  imagewidth: number;
  imageheight: number;
  tilecount: number;
}

export function patchTilesets(
  rawMapJson: { tilesets: unknown[] },
  defs: readonly TilesetDef[],
  tileSize: number,
): void {
  rawMapJson.tilesets = defs.map((tileset) => ({
    firstgid: tileset.firstgid,
    name: tileset.name,

    image: tileset.path.split('/').pop(),
    imagewidth: tileset.imagewidth,
    imageheight: tileset.imageheight,

    columns: tileset.columns,
    tilecount: tileset.tilecount,

    tilewidth: tileSize,
    tileheight: tileSize,

    margin: 0,
    spacing: 0,
  }));
}
