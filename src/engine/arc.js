// ARC grids, with no drawing and no page: the colour palette, reading and checking grids, and describing them in words.
// ARC (the Abstraction and Reasoning Corpus) shows a few example grids, each next to its answer; the puzzle is
// to find the rule and apply it to a new grid. Grids are 1 to 30 cells a side, and each cell is a colour from 0 to 9.

// The ten ARC colours as the original 2019 task viewer draws them (github.com/fchollet/ARC-AGI, apps/css/common.css,
// Apache-2.0). Plain colour values; never draw them as a 5 x 2 block, which is the ARC Prize logo.
export const ARC_COLORS = ['#000000', '#0074D9', '#FF4136', '#2ECC40', '#FFDC00', '#AAAAAA', '#F012BE', '#FF851B', '#7FDBFF', '#870C25'];
export const ARC_NAMES = ['black', 'blue', 'red', 'green', 'yellow', 'grey', 'magenta', 'orange', 'light blue', 'maroon'];

/**
 * Reads a grid written either as rows of digits ('00120', ...) or as arrays of numbers ([[0, 0, 1], ...]),
 * which is ARC's own JSON format. Returns arrays of numbers, or throws with a helpful message.
 */
export function readGrid(grid, label = 'grid') {
  if (!Array.isArray(grid) || grid.length === 0) throw new Error(`${label} needs at least one row`);
  const rows = grid.map((row) => (typeof row === 'string' ? [...row].map(Number) : Array.isArray(row) ? row.map(Number) : null));
  if (rows.some((row) => !row)) throw new Error(`${label}: each row must be a string of digits or an array of numbers`);
  const width = rows[0].length;
  if (width < 1 || width > 30 || rows.length > 30) throw new Error(`${label} must be 1 to 30 cells on each side`);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${label}: row ${y} has ${row.length} cells, but row 0 has ${width}`);
    row.forEach((cell, x) => {
      if (!Number.isInteger(cell) || cell < 0 || cell > 9) throw new Error(`${label}: the cell at row ${y}, column ${x} is not a colour from 0 to 9`);
    });
  });
  return rows;
}

/** Reads a whole task: { train: [{ input, output }, ...], test: [{ input, output }] } (ARC's JSON, or rows of digits). */
export function readTask(task) {
  if (!task || !Array.isArray(task.train) || !Array.isArray(task.test) || task.test.length === 0) {
    throw new Error('a task needs "train" (example pairs) and "test" (at least one pair)');
  }
  const pair = (p, name) => ({ input: readGrid(p.input, `${name} input`), output: readGrid(p.output, `${name} output`) });
  return { train: task.train.map((p, i) => pair(p, `example ${i + 1}`)), test: task.test.map((p, i) => pair(p, `test ${i + 1}`)) };
}

export function sameGrid(a, b) {
  return a.length === b.length && a.every((row, y) => row.length === b[y].length && row.every((cell, x) => cell === b[y][x]));
}

export function copyGrid(grid) {
  return grid.map((row) => [...row]);
}

/** The grid read row by row, from the top left, the way a language model reads it: one long line of cells. */
export function flatten(grid) {
  return grid.flat();
}

/** A grid in words, for screen readers: '3 by 3. Row 1: black, red, black. Row 2: ...' */
export function describeGrid(grid) {
  const rows = grid.map((row, y) => `Row ${y + 1}: ${row.map((cell) => ARC_NAMES[cell]).join(', ')}.`);
  return `${grid[0].length} by ${grid.length}. ${rows.join(' ')}`;
}

/**
 * Draws a grid (rows of digits or arrays of numbers) on a 2D canvas context, e.g. a Painter's p.ctx:
 * `cell` pixels per cell, with a `gap` of `line` colour between cells. Returns the size it took.
 */
export function paintGrid(ctx, grid, x, y, { cell = 4, gap = 1, line = '#555555', colors = ARC_COLORS } = {}) {
  grid = grid.map((row) => (typeof row === 'string' ? [...row].map(Number) : row));
  const width = grid[0].length * (cell + gap) + gap;
  const height = grid.length * (cell + gap) + gap;
  if (gap) {
    ctx.fillStyle = line;
    ctx.fillRect(x, y, width, height);
  }
  grid.forEach((row, j) => {
    row.forEach((value, i) => {
      ctx.fillStyle = colors[value];
      ctx.fillRect(x + gap + i * (cell + gap), y + gap + j * (cell + gap), cell, cell);
    });
  });
  return { width, height };
}
