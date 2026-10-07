import { ARC_COLORS } from './arc.js';
import { TILE } from './constants.js';
import { Painter, fromRows, hash, makeCanvas } from './pixels.js';

// Every tile in a map is one character. This file says what each character looks like and
// whether you can walk on it. Add new tile types here if you need them (and list them in the README).

const C = {
  grass: '#8cd068',
  grassDark: '#70b450',
  grassLight: '#a8e488',
  path: '#ecd6a4',
  pathShade: '#d8bc84',
  pathDot: '#c8a46c',
  water: '#58a8f0',
  waterDeep: '#4890e0',
  waterLight: '#b8e4ff',
  foam: '#e8f4ff',
  red: '#f05050',
  yellow: '#f8d838',
  white: '#ffffff',
  stem: '#4a9a3a',
  leaf: '#3c9c4c',
  leafLight: '#84d474',
  leafDark: '#287838',
  trunk: '#8a5a34',
  trunkDark: '#5e3a20',
  treeLine: '#1e3a28',
  fence: '#f4ecd8',
  fenceShade: '#c8b898',
  fenceLine: '#6a5a48',
  wall: '#ece2c6',
  wallStripe: '#e0d4b2',
  wallTop: '#c9b88e',
  board: '#6e4426',
  boardLight: '#8e5c36',
  boardDark: '#4a2c18',
  wood: '#d09a62',
  woodLight: '#dcab74',
  woodSeam: '#a87240',
  chessLight: '#f0d9b5',
  chessDark: '#b58863',
  chessLightEdge: '#e2c89e',
  chessDarkEdge: '#a47852',
  ondol: '#e6c07a',
  ondolDim: '#e3ba71',
  ondolSheen: '#eccc8c',
  ondolSeam: '#d6ac66',
  stone: '#bdb6a6',
  stoneLight: '#d2ccbe',
  stoneSeam: '#99917f',
  carpet: '#241d45',
  carpetRim: '#3a2f6e',
  neon: ['#e0409a', '#40c8e8', '#f0d040', '#7ae070'],
  cellSeam: '#333333',
  floorShadow: 'rgba(70, 40, 20, 0.28)',
};

// Bit flags for "which neighbours are different": north, east, south, west.
const N = 1;
const E = 2;
const S = 4;
const W = 8;

function edges(area, x, y, isEdge) {
  return (
    (isEdge(area.charAt(x, y - 1)) ? N : 0) |
    (isEdge(area.charAt(x + 1, y)) ? E : 0) |
    (isEdge(area.charAt(x, y + 1)) ? S : 0) |
    (isEdge(area.charAt(x - 1, y)) ? W : 0)
  );
}

function drawGrass(p, { variant }) {
  p.rect(0, 0, TILE, TILE, C.grass);
  const bits = hash(variant, 99);
  [[2, 5], [9, 3], [12, 11], [5, 12], [13, 6]].forEach(([x, y], i) => {
    if (bits & (1 << i)) p.vline(x, y, 2, C.grassDark).vline(x + 2, y - 1, 3, C.grassDark);
  });
  if (bits & 64) p.px(7, 8, C.grassLight);
  if (bits & 128) p.px(14, 14, C.grassLight);
  if (bits & 256) p.px(3, 1, C.grassLight);
}

function drawPath(p, { variant, mask }) {
  p.rect(0, 0, TILE, TILE, C.path);
  const bits = hash(variant, 5);
  if (bits & 1) p.hline(3, 5, 2, C.pathDot);
  if (bits & 2) p.hline(10, 11, 2, C.pathDot);
  if (bits & 4) p.px(12, 3, C.pathDot);
  if (bits & 8) p.px(5, 13, C.pathDot);
  if (mask & N) p.rect(0, 0, TILE, 2, C.pathShade);
  if (mask & W) p.rect(0, 0, 2, TILE, C.pathShade);
  if (mask & E) p.vline(TILE - 1, 0, TILE, C.pathShade);
  if (mask & S) p.hline(0, TILE - 1, TILE, C.pathShade);
  for (let i = 0; i < TILE; i += 4) {
    // little grass tufts poking over the edges
    if (mask & N) p.hline(i + 1, 0, 2, C.grass);
    if (mask & S) p.px(i + 2, TILE - 1, C.grass);
    if (mask & W) p.vline(0, i + 1, 2, C.grass);
    if (mask & E) p.px(TILE - 1, i + 2, C.grass);
  }
}

function drawWater(p, { variant, mask, frame }) {
  p.rect(0, 0, TILE, TILE, C.water);
  const o = (frame * 3 + variant * 5) % 12;
  p.hline((o + 1) % 12, 4, 3, C.waterLight);
  p.hline((o + 7) % 12, 10, 3, C.waterLight);
  if (mask & N) p.rect(0, 0, TILE, 2, C.foam).hline(mask & W ? 2 : 0, 2, TILE - (mask & W ? 2 : 0) - (mask & E ? 2 : 0), C.waterDeep);
  if (mask & S) p.rect(0, TILE - 2, TILE, 2, C.foam);
  if (mask & W) p.rect(0, 0, 2, TILE, C.foam);
  if (mask & E) p.rect(TILE - 2, 0, 2, TILE, C.foam);
  // round off outer corners
  const corner = (x, y, dx, dy) => p.px(x, y, C.grass).px(x + dx, y, C.grass).px(x, y + dy, C.grass);
  if ((mask & N) && (mask & W)) corner(0, 0, 1, 1);
  if ((mask & N) && (mask & E)) corner(TILE - 1, 0, -1, 1);
  if ((mask & S) && (mask & W)) corner(0, TILE - 1, 1, -1);
  if ((mask & S) && (mask & E)) corner(TILE - 1, TILE - 1, -1, -1);
}

const FLOWER_BEDS = [
  ['................', '................', '..R.............', '.RYR......W.....', '..R......WYW....', '..g.......W.....', '..g.......g.....', '................',
    '................', '.....W..........', '....WYW.....R...', '.....W.....RYR..', '.....g......R...', '.....g......g...', '................', '................'],
  ['................', '.........R......', '........RYR.....', '.W.......R......', 'WYW......g......', '.W..............', '.g..............', '................',
    '............W...', '...R.......WYW..', '..RYR.......W...', '...R........g...', '...g............', '................', '................', '................'],
];

function drawFlowers(p, { variant, frame }) {
  drawGrass(p, { variant: variant + 50 });
  const bed = FLOWER_BEDS[variant % FLOWER_BEDS.length];
  const colors = { R: C.red, Y: C.yellow, W: C.white, g: C.stem };
  bed.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') p.px(x + (frame && ch !== 'g' ? 1 : 0), y, colors[ch]);
    });
  });
}

function drawBush(p, { variant }) {
  drawGrass(p, { variant });
  p.ellipse(8, 9, 7, 6, C.treeLine)
    .ellipse(8, 9, 6, 5, C.leaf)
    .ellipse(6, 7, 3, 2, C.leafLight)
    .hline(5, 14, 7, C.leafDark)
    .hline(10, 12, 3, C.leafDark);
}

function drawFence(p, { variant, mask }) {
  drawGrass(p, { variant });
  // mask bits mark neighbours that are fences too, so rails connect to them
  if (mask & W) p.rect(0, 5, 8, 2, C.fence).rect(0, 10, 8, 2, C.fence).hline(0, 7, 8, C.fenceShade).hline(0, 12, 8, C.fenceShade);
  if (mask & E) p.rect(8, 5, 8, 2, C.fence).rect(8, 10, 8, 2, C.fence).hline(8, 7, 8, C.fenceShade).hline(8, 12, 8, C.fenceShade);
  p.rect(5, 2, 6, 13, C.fenceLine).rect(6, 3, 4, 11, C.fence).vline(9, 4, 10, C.fenceShade);
}

function drawWallTop(p) {
  p.rect(0, 0, TILE, TILE, C.wall);
  for (let x = 0; x < TILE; x += 4) p.vline(x, 0, TILE, C.wallStripe);
  p.rect(0, 0, TILE, 3, C.wallTop);
}

function drawWallBase(p) {
  p.rect(0, 0, TILE, TILE, C.wall);
  for (let x = 0; x < TILE; x += 4) p.vline(x, 0, 10, C.wallStripe);
  p.rect(0, 10, TILE, 6, C.board).hline(0, 10, TILE, C.boardLight).hline(0, TILE - 1, TILE, C.boardDark);
}

/** The soft shadow a back wall casts on the floor row below it (for floors whose `edges` is isWall). */
export function floorShadow(p, mask) {
  if (mask & N) p.rect(0, 0, TILE, 3, C.floorShadow);
}

function drawWoodFloor(p, { variant, mask }) {
  p.rect(0, 0, TILE, TILE, C.wood);
  for (let y = 0; y < TILE; y += 4) {
    p.hline(0, y + 3, TILE, C.woodSeam).hline(0, y, TILE, C.woodLight);
    p.vline(((y / 4) * 5 + variant * 3) % TILE, y, 3, C.woodSeam);
  }
  floorShadow(p, mask);
}

function drawCheckerFloor(p, { variant, mask }) {
  const light = variant === 0;
  p.rect(0, 0, TILE, TILE, light ? C.chessLight : C.chessDark).hline(0, TILE - 1, TILE, light ? C.chessLightEdge : C.chessDarkEdge);
  floorShadow(p, mask);
}

// The floor of a traditional Korean room (ondol): sheets of glossy oiled paper, with soft seams where they meet.
function drawOndolFloor(p, { variant, mask }) {
  p.rect(0, 0, TILE, TILE, variant % 2 ? C.ondolDim : C.ondol);
  p.hline(0, TILE - 1, TILE, C.ondolSeam).vline(TILE - 1, 0, TILE, C.ondolSeam);
  if (variant === 1) p.hline(3, 4, 4, C.ondolSheen).hline(2, 5, 2, C.ondolSheen);
  if (variant === 2) p.hline(9, 10, 3, C.ondolSheen);
  floorShadow(p, mask);
}

// One cell of an ARC grid, in its colour, with a thin dark seam like the grid lines of ARC's own viewer.
// Colour 0 is drawn a little lighter than pure black, so the cells never melt into the black void around rooms.
function arcCell(color) {
  return (p, { mask }) => {
    p.rect(0, 0, TILE, TILE, color === 0 ? '#141414' : ARC_COLORS[color]);
    p.hline(0, TILE - 1, TILE, C.cellSeam).vline(TILE - 1, 0, TILE, C.cellSeam);
    floorShadow(p, mask);
  };
}

// Stone paving, e.g. a kerb around an ARC floor so its black cells never touch the black void.
function drawStone(p, { variant, mask }) {
  p.rect(0, 0, TILE, TILE, C.stone);
  p.hline(0, 0, TILE, C.stoneLight).vline(0, 0, TILE, C.stoneLight);
  p.hline(0, TILE - 1, TILE, C.stoneSeam).vline(TILE - 1, 0, TILE, C.stoneSeam);
  if (variant === 1) p.px(5, 6, C.stoneSeam).px(6, 7, C.stoneSeam);
  if (variant === 2) p.px(10, 11, C.stoneLight).px(11, 11, C.stoneSeam);
  floorShadow(p, mask);
}

// An arcade's carpet: deep indigo with little neon squiggles, a lighter rim where the room ends, and the wall's shadow.
function drawCarpet(p, { variant, mask }) {
  p.rect(0, 0, TILE, TILE, C.carpet);
  const neon = C.neon[variant % C.neon.length];
  const [x, y] = [[3, 4], [9, 10], [10, 3], [4, 11]][variant % 4];
  p.px(x, y, neon).px(x + 1, y - 1, neon).px(x + 2, y, neon).px(x + 3, y - 1, neon);
  if (mask & E) p.vline(TILE - 1, 0, TILE, C.carpetRim);
  if (mask & S) p.hline(0, TILE - 1, TILE, C.carpetRim);
  if (mask & W) p.vline(0, 0, TILE, C.carpetRim);
  floorShadow(p, mask);
}

/** True for the back wall's two rows: floors use it as their `edges`, to draw the wall's shadow on the row below. */
export const isWall = (ch) => ch === 'W' || ch === 'w';

// Tall things that stick out above their tile (so they can hide the player) are "objects".
const TREE_ROWS = [
  '.....AAAAAA.....',
  '...AALLAAAAAA...',
  '..ALLLAAAAAAAA..',
  '.ALLAAAAAAAAAAA.',
  '.ALAAAAAAAAAADA.',
  'AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAADDA',
  'ALAAAAAAAAAAAADA',
  'AAAAAAAAAAAADDDA',
  'AAAAAAAAAAAADDDD',
  'AAAAAAAAAAADDDDA',
  '.AAAAAAAAADDDDD.',
  '.AADAAAADDDDDDD.',
  '..ADDDDDDDDDDA..',
  '...DDDDDDDDDD...',
  '.....DttttD.....',
  '......tTTt......',
  '......tTTt......',
  '......tTTt......',
  '.....ttTTtt.....',
  '................',
];

let treeSprite = null;
function tree() {
  if (!treeSprite) {
    treeSprite = fromRows(TREE_ROWS, { A: C.leaf, L: C.leafLight, D: C.leafDark, t: C.trunkDark, T: C.trunk });
    new Painter(treeSprite).outline(C.treeLine);
  }
  return treeSprite;
}

/**
 * The tile types. Fields:
 *   solid     - true if nobody can walk there
 *   draw      - paints the 16x16 ground picture
 *   variants  - how many random-looking versions to make (or a function (x, y) => number)
 *   edges     - which neighbouring characters count as "different" (for borders and shores)
 *   frames, frameTicks - animation
 *   sprite    - a tall picture drawn on top and depth-sorted with the player (trees)
 */
export const TILES = {
  '.': { name: 'grass', variants: 16, draw: drawGrass },
  '*': { name: 'flowers', variants: 16, frames: 2, frameTicks: 30, draw: drawFlowers },
  '=': { name: 'path', variants: 16, edges: (ch) => ch !== '=', draw: drawPath },
  '~': { name: 'water', solid: true, variants: 4, edges: (ch) => ch !== '~', frames: 4, frameTicks: 16, draw: drawWater },
  T: { name: 'tree', solid: true, variants: 16, draw: drawGrass, sprite: tree },
  b: { name: 'bush', solid: true, variants: 16, draw: drawBush },
  F: { name: 'fence', solid: true, variants: 16, edges: (ch) => ch === 'F', draw: drawFence },
  W: { name: 'wall (top)', solid: true, draw: drawWallTop },
  w: { name: 'wall (bottom)', solid: true, draw: drawWallBase },
  _: { name: 'wooden floor', variants: 4, edges: isWall, draw: drawWoodFloor },
  x: { name: 'chessboard floor', variants: (x, y) => (x + y) & 1, edges: isWall, draw: drawCheckerFloor },
  o: { name: 'ondol floor', variants: 4, edges: isWall, draw: drawOndolFloor },
  k: { name: 'stone', variants: 3, edges: isWall, draw: drawStone },
  c: { name: 'arcade carpet', variants: 4, edges: (ch) => isWall(ch) || ch === ' ', draw: drawCarpet },
  ' ': { name: 'nothing', solid: true, draw: (p) => p.rect(0, 0, TILE, TILE, '#000') },
};
// ARC grid cells, '0' to '9': the same digits ARC uses, so a task's rows can be pasted straight into a room's map.
ARC_COLORS.forEach((_, i) => {
  TILES[String(i)] = { name: `ARC cell ${i}`, edges: isWall, draw: arcCell(i) };
});

/** Draws each distinct tile picture once and reuses it. */
export class TileCache {
  constructor() {
    this.cache = new Map();
    this.ids = new WeakMap(); // one number per tile type, so two rooms can use the same letter for different tiles
    this.nextId = 0;
  }

  typeId(type) {
    if (!this.ids.has(type)) this.ids.set(type, this.nextId++);
    return this.ids.get(type);
  }

  get(area, x, y, tick, animate = true) {
    const type = area.tileAt(x, y);
    const variant = typeof type.variants === 'function' ? type.variants(x, y) : type.variants ? hash(x, y) % type.variants : 0;
    const mask = type.edges ? edges(area, x, y, type.edges) : 0;
    const frame = type.frames && animate ? Math.floor(tick / type.frameTicks) % type.frames : 0;
    const key = `${this.typeId(type)}|${variant}|${mask}|${frame}`;
    let canvas = this.cache.get(key);
    if (!canvas) {
      canvas = makeCanvas(TILE, TILE);
      type.draw(new Painter(canvas), { variant, mask, frame });
      this.cache.set(key, canvas);
    }
    return canvas;
  }
}
