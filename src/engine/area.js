import { TILES } from './tiles.js';

const key = (x, y) => `${x},${y}`;

/** One walkable map: the town, or the inside of a building. */
export class Area {
  constructor({ id, name, rows, border, tiles = null }) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error(`Map "${id}" has no rows`);
    this.id = id;
    this.name = name;
    // A copy, so changing a tile (setTile) never edits the content file's own map, and reset() can bring it back.
    this.startRows = rows.map(String);
    this.rows = [...this.startRows];
    this.border = border; // what is drawn (and solid) outside the map
    // The tile types this map can use: the built-in ones, plus any its content adds (a building's own floors).
    this.tileTypes = tiles ? { ...TILES, ...tiles } : TILES;
    this.width = Math.max(...this.rows.map((row) => row.length));
    this.height = this.rows.length;
    // Rows are compared with the most common length, so the odd one out is the one named.
    const lengths = this.rows.map((row) => row.length);
    const count = (n) => lengths.filter((m) => m === n).length;
    const usual = lengths.reduce((best, n) => (count(n) > count(best) ? n : best));
    this.rows.forEach((row, y) => {
      if (row.length !== usual) console.warn(`Map "${id}": row ${y} is ${row.length} characters long, but most rows are ${usual}.`);
      [...row].forEach((ch, x) => {
        if (!this.tileTypes[ch]) console.warn(`Map "${id}": unknown tile "${ch}" at (${x}, ${y}); treated as "${border}".`);
      });
    });
    this.blocked = new Uint8Array(this.width * this.height);
    this.objects = [];
    this.occupants = new Map();
    this.warps = new Map();
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  charAt(x, y) {
    if (!this.inBounds(x, y)) return this.border;
    const ch = this.rows[y][x];
    return ch !== undefined && this.tileTypes[ch] ? ch : this.border;
  }

  tileAt(x, y) {
    return this.tileTypes[this.charAt(x, y)];
  }

  isSolid(x, y) {
    return !this.inBounds(x, y) || Boolean(this.tileAt(x, y).solid) || this.blocked[y * this.width + x] === 1;
  }

  /** Changes one tile, e.g. to paint a floor cell or open a gate. Returns false if it can't. */
  setTile(x, y, ch) {
    if (!this.inBounds(x, y) || x >= this.rows[y].length) return false;
    if (!this.tileTypes[ch]) {
      console.warn(`Map "${this.id}": setTile(${x}, ${y}) got the unknown tile "${ch}"`);
      return false;
    }
    const row = this.rows[y];
    this.rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
    return true;
  }

  /** Puts every tile back the way the map started (objects stay as they are). */
  reset() {
    this.rows = [...this.startRows];
  }

  /**
   * Adds a drawable object. It needs: sprite, x, y (top-left in pixels), sortY (the pixel row its
   * base stands on, for depth sorting), tiles ([[x, y], ...] it covers) and solid. Optional: text
   * (pages shown when the player presses A in front of it), layer: 'ground' (drawn under everything).
   */
  add(object) {
    this.objects.push(object);
    for (const [x, y] of object.tiles ?? []) {
      if (!this.inBounds(x, y)) continue;
      this.occupants.set(key(x, y), object);
      if (object.solid) this.blocked[y * this.width + x] = 1;
    }
    return object;
  }

  /** Takes an object off the map: it no longer draws, blocks or reads. */
  remove(object) {
    const i = this.objects.indexOf(object);
    if (i < 0) return;
    this.objects.splice(i, 1);
    this.refresh(object.tiles ?? []);
  }

  /** Makes an object block the way (or stop blocking it), e.g. a gate that opens. */
  setSolid(object, solid) {
    object.solid = solid;
    this.refresh(object.tiles ?? []);
  }

  // Works out again who stands on these tiles, and whether they are blocked: the last object added wins, as in add().
  refresh(tiles) {
    for (const [x, y] of tiles) {
      if (!this.inBounds(x, y)) continue;
      const here = this.objects.filter((o) => o.tiles?.some(([ox, oy]) => ox === x && oy === y));
      if (here.length) this.occupants.set(key(x, y), here[here.length - 1]);
      else this.occupants.delete(key(x, y));
      this.blocked[y * this.width + x] = here.some((o) => o.solid) ? 1 : 0;
    }
  }

  objectAt(x, y) {
    return this.occupants.get(key(x, y)) ?? null;
  }

  addWarp(x, y, warp) {
    const stored = { ...warp, x, y };
    this.warps.set(key(x, y), stored);
    return stored;
  }

  warpAt(x, y) {
    return this.warps.get(key(x, y)) ?? null;
  }
}
