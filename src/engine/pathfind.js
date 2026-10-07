import { DIRS } from './constants.js';

const ORDER = ['up', 'down', 'left', 'right'];

/** Every walkable tile reachable from `start`, found breadth-first (so nearer tiles come first). */
export function explore(area, [sx, sy]) {
  const width = area.width;
  const prev = new Map([[sy * width + sx, null]]);
  const tiles = [[sx, sy]];
  for (let i = 0; i < tiles.length; i++) {
    const [x, y] = tiles[i];
    for (const dir of ORDER) {
      const [dx, dy] = DIRS[dir];
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * width + nx;
      if (!area.inBounds(nx, ny) || prev.has(k) || area.isSolid(nx, ny)) continue;
      if (dir === 'down' && area.exit && x === area.exit.x && y === area.exit.y) continue; // walking down off the mat leaves the room
      prev.set(k, { from: y * width + x, dir });
      tiles.push([nx, ny]);
    }
  }
  return { prev, width, tiles };
}

/** The directions to walk from the start of `reach` to (x, y), or null if it can't be reached. */
export function pathTo(reach, [x, y]) {
  let k = y * reach.width + x;
  if (x < 0 || y < 0 || x >= reach.width || !reach.prev.has(k)) return null;
  const dirs = [];
  for (let step = reach.prev.get(k); step; step = reach.prev.get(k)) {
    dirs.push(step.dir);
    k = step.from;
  }
  return dirs.reverse();
}

/** The reachable tile closest to (x, y). */
export function nearest(reach, [x, y]) {
  let best = null;
  let bestDistance = Infinity;
  for (const [tx, ty] of reach.tiles) {
    const distance = Math.abs(tx - x) + Math.abs(ty - y);
    if (distance < bestDistance) {
      best = [tx, ty];
      bestDistance = distance;
    }
  }
  return best;
}
