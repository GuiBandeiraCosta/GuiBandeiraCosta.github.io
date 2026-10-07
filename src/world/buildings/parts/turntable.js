import { paintGrid } from '../../../engine/arc.js';

// A giant ARC puzzle board standing on a turntable, with a crank on its side: the ARC-AGI building (arc.js), about my
// paper's turned puzzle. The board shows the paper's line puzzle, solved: wherever both ends of a row share a colour,
// the row is filled in. Every 2 seconds it swaps between the turned picture (the lines run up and down) and the sideways one, and the crank's handle swings round,
// as if someone had just turned it. No letters, digits or logos: the words go in the text box.

// The puzzles, written sideways (rows of ARC colours: 0 black, 2 red, 3 green, 4 yellow, 8 light blue).
export const PUZZLES = {
  floor: ['20002', '00000', '30004', '00000', '80008'], // 5 x 5: chunky enough for a floor, one tile per cell
};

/** A grid (rows of digits) turned a quarter turn clockwise, the way the turntable turns it. */
export function turnGrid(rows) {
  const height = rows.length;
  return Array.from({ length: rows[0].length }, (_, y) => Array.from({ length: height }, (_, x) => rows[height - 1 - x][y]).join(''));
}

/** The puzzle's rule (my paper's line puzzle, ARC task 22eb0ac0): a row whose two ends share a colour is filled in. */
export function fillRows(rows) {
  return rows.map((row) => (row[0] !== '0' && row[0] === row[row.length - 1] ? row[0].repeat(row.length) : row));
}

/** The same rule down the columns: how the puzzle is solved once it has been turned. */
export function fillColumns(rows) {
  return transpose(fillRows(transpose(rows)));
}

function transpose(rows) {
  return Array.from({ length: rows[0].length }, (_, x) => rows.map((row) => row[x]).join(''));
}

// The look: a dark toy plinth with a teal platter, a yellow frame and a rotate arrow.
// Each disc's side goes from light to dark, lit from the top left; the platter's side has dots like a record player's.
export const TURNTABLES = {
  dark: {
    frame: { light: '#ffe68e', base: '#f2b632', shade: '#c4861e' },
    base: { side: ['#5c606e', '#4c505c', '#40434e', '#353842', '#2a2c34'], face: '#545866', faceLight: '#686c7a' },
    platter: { side: ['#6cd0c8', '#4cb8b0', '#38a098', '#2c847e', '#226a66'], face: '#2a3a40', faceLight: '#3a4e56', dots: '#ffe68e' },
    shadow: '#24262e',
    post: '#8e929e', postLight: '#b4b8c2',
    door: '#9aa0ac', doorLight: '#bcc2cc', doorFrame: '#f2b632', handle: '#2c2e36',
    crank: '#8e929e', knob: '#e8503a', knobLight: '#ff8e6e',
    arrow: '#e8503a',
    outline: '#121318',
  },
};

/**
 * The building's picture: two frames that swap every 2 seconds. Frame 0 is the turned puzzle (also the still frame
 * for visitors who prefer reduced motion, and the one taps are checked against); frame 1 is the puzzle sideways.
 *   sprite: turntableSprite({ puzzle: PUZZLES.floor, cell: 5, arrow: true, height: 74 }),
 *   door: { height: 20 },
 * `puzzle` is written sideways and unsolved; `cell` is the size of one square in pixels; `arrow` adds a curved
 * double-headed arrow over the board, the usual sign for "turn me". The height must leave room for the board:
 * its bottom is 31 px above the picture's, and it is `cell + 1` pixels per square plus 5, plus 8 for the arrow.
 */
export function turntableSprite({ puzzle, cell = 7, look = 'dark', arrow = false, height = 110 }) {
  const sideways = fillRows(puzzle);
  const grids = [turnGrid(sideways), sideways];
  return {
    width: 88,
    height,
    frames: 2,
    frameTicks: 120,
    still: 0,
    draw: (p, info) => drawTurntable(p, info, { grid: grids[info.frame ?? 0], cell, look: TURNTABLES[look], arrow, crankUp: !info.frame }),
  };
}

/** Draws the whole building into a picture 88 px wide, with its door exactly in `door`. */
export function drawTurntable(p, { width: W, height: H, door }, { grid, cell, look: c, arrow = false, crankUp = true }) {
  const cx = W / 2;
  // How far the front of a disc curves down at column x (1 in the middle, 0 at its edges).
  const front = (x, half) => Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / half) ** 2));
  // The turntable: a wide stone base, and on it a platter that turns, round discs seen from a little above.
  // The door (20 px) fits in their sides, below the platter's top.
  disc(p, cx, H - 20, H - 6, 40, 5, c.base.side);
  p.ellipse(cx, H - 20, 39, 4, c.base.face).ellipse(cx - 8, H - 21, 24, 2, c.base.faceLight);
  for (let x = cx - 33; x < cx + 33; x++) p.px(x, H - 20 + Math.round(3 * front(x, 33)), c.shadow);
  disc(p, cx, H - 26, H - 21, 33, 3, c.platter.side);
  for (let x = cx - 30; x < cx + 30; x += 4) p.px(x, H - 23 + Math.round(3 * front(x, 33)), c.platter.dots);
  p.ellipse(cx, H - 26, 32, 3, c.platter.face).ellipse(cx, H - 26, 24, 2, c.platter.faceLight).ellipse(cx, H - 26, 18, 1, c.platter.face);

  // The board, on a short post in the middle of the platter. Its top edge and right side show, lit from the top left.
  const size = grid.length * (cell + 1) + 1;
  const bw = size + 5;
  const bh = size + 4;
  const bx = Math.round(cx - bw / 2);
  const by = H - 31 - bh;
  p.rect(cx - 3, by + bh, 6, H - 26 - by - bh, c.post).vline(cx - 3, by + bh, H - 26 - by - bh, c.postLight);
  p.rect(bx, by, bw, bh, c.frame.base).rect(bx, by, bw - 3, 2, c.frame.light).vline(bx, by, bh, c.frame.light);
  p.rect(bx + bw - 3, by, 3, bh, c.frame.shade).hline(bx + 1, by + bh - 1, bw - 4, c.frame.shade);
  paintGrid(p.ctx, grid, bx + 2, by + 2, { cell, gap: 1, line: '#3a3a40' });

  // The crank on the base's right side: its handle points up in one picture and down in the other.
  const ay = H - 14;
  p.rect(cx + 40, ay, 2, 2, c.crank);
  const [armY, knobY] = crankUp ? [ay - 8, ay - 11] : [ay, ay + 8];
  p.rect(cx + 41, armY, 2, 10, c.crank).rect(cx + 40, knobY, 3, 3, c.knob).px(cx + 40, knobY, c.knobLight);

  if (arrow) drawRotateArrow(p, cx, by, bw, c.arrow);

  // The door goes exactly where the game expects it (it animates the doorway when it opens).
  const bottom = H - 1;
  p.rect(door.x - 2, door.y - 2, door.w + 4, bottom - door.y + 2, c.doorFrame);
  p.rect(door.x, door.y, door.w, bottom - door.y, c.door);
  p.rect(door.x + 2, door.y + 2, door.w - 4, 4, c.doorLight).vline(door.x + door.w / 2, door.y + 7, bottom - door.y - 8, c.doorLight);
  p.px(door.x + door.w - 4, door.y + 12, c.handle).px(door.x + 3, door.y + 12, c.handle);
  p.outline(c.outline);
}

// A disc's round side, from `top` to `bottom` at its left and right edges; its front curves down towards us by
// `bulge`. `tones` go from light to dark, lit from the top left.
function disc(p, cx, top, bottom, half, bulge, tones) {
  for (let x = cx - half; x < cx + half; x++) {
    const t = (x + 0.5 - cx) / half;
    const tone = tones[t < -0.6 ? 0 : t < -0.1 ? 1 : t < 0.4 ? 2 : t < 0.75 ? 3 : 4];
    p.vline(x, top, bottom - top + 1 + Math.round(bulge * Math.sqrt(1 - t * t)), tone);
  }
}

/** A curved arrow over the top of a board, with a head at each end: turn it either way. */
export function drawRotateArrow(p, cx, top, width, color) {
  const rx = width / 2 + 4;
  const cy = top + 4;
  for (let a = 0; a <= 180; a += 3) {
    const t = (a * Math.PI) / 180;
    p.rect(Math.round(cx + rx * Math.cos(t) - 1), Math.round(cy - 10 * Math.sin(t) - 1), 2, 2, color);
  }
  for (const x of [cx - rx, cx + rx]) {
    for (let i = 0; i < 4; i++) p.hline(Math.round(x) - 4 + i, cy + 1 + i, 8 - 2 * i, color);
  }
}
