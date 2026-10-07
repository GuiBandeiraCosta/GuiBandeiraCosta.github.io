import { TILE } from './constants.js';
import { Area } from './area.js';
import { DECOR, STAIRS } from './decor.js';
import { Painter, flipX, fromRows, makeCanvas } from './pixels.js';

// Turns the content in src/world/ into walkable areas, and explains mistakes in the browser console.

const warn = (message) => console.warn(`[town] ${message}`);
const toPages = (text) => (Array.isArray(text) ? text : [text]).map(String);
export const FLOORS = { wood: '_', checker: 'x', ondol: 'o', arcade: 'c', stone: 'k' };
// What a room can do when things happen in it (see "Interactive rooms" in README.md).
const ROOM_HOOKS = ['onEnter', 'onLeave', 'onStep', 'onUse', 'onTouch', 'update', 'overlay'];

/**
 * Makes a picture from any of the three sprite formats:
 *   { image: 'assets/my-building.png' }               a PNG you drew (e.g. in Piskel or Aseprite)
 *   { pixels: [...rows], palette: {...}, outline }      text art, one character per pixel
 *   { width, height, draw(p, info) { ... } }            drawn in code with a Painter (see pixels.js)
 */
export async function makeSprite(spec, size = {}, info = {}) {
  if (spec?.image) {
    const img = await loadImage(spec.image);
    const canvas = makeCanvas(img.naturalWidth, img.naturalHeight);
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas;
  }
  if (spec?.pixels) {
    const canvas = fromRows(spec.pixels, spec.palette ?? {});
    if (spec.outline) new Painter(canvas).outline(spec.outline);
    return canvas;
  }
  if (typeof spec?.draw === 'function') {
    const canvas = makeCanvas(spec.width ?? size.width, spec.height ?? size.height);
    spec.draw(new Painter(canvas), info);
    return canvas;
  }
  throw new Error('its sprite needs "image", "pixels" or "draw"');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load "${src}" (check the path, including upper/lower case)`));
    img.src = src;
  });
}

/**
 * Every frame of a picture. A picture drawn in code can animate: `frames` is how many pictures to draw
 * (draw() gets info.frame = 0, 1, ...) and `frameTicks` how long each one shows (60 ticks = 1 second;
 * keep it at 30 or more, so nothing flashes more than twice a second). `still` is the frame shown to
 * visitors who prefer reduced motion (0 if not given).
 */
async function makePicture(spec, size, info) {
  const count = typeof spec?.draw === 'function' ? Math.max(1, Math.floor(spec.frames ?? 1)) : 1;
  const frames = [];
  for (let frame = 0; frame < count; frame++) frames.push(await makeSprite(spec, size, { ...info, frame }));
  return { frames, frameTicks: Math.max(1, spec?.frameTicks ?? 30), still: Math.min(count - 1, Math.max(0, spec?.still ?? 0)) };
}

/** The frame of a picture to draw now. */
export function frameOf(picture, tick, animate) {
  if (picture.frames.length === 1) return picture.frames[0];
  if (!animate) return picture.frames[picture.still];
  return picture.frames[Math.floor(tick / picture.frameTicks) % picture.frames.length];
}

// Which of an object's pictures to draw: `show(state, object)` names one, for things that change (a lock that opens).
function currentPicture(o) {
  if (!o.show) return o.pictures[o.picture];
  let name;
  try {
    name = o.show(o.state, o);
  } catch (err) {
    console.error(`[town] ${o.label}: its "show" failed, so it keeps its first picture: ${err.message}`);
    o.show = null;
  }
  return o.pictures[name] ?? o.pictures[o.picture];
}

export async function buildTown(town, buildings, options = {}) {
  const area = new Area({ id: 'town', name: 'Town', rows: town.map, border: town.border ?? 'T', tiles: town.tiles });
  area.state = {};
  const placed = [];
  const ids = new Set();
  for (const def of buildings) {
    try {
      if (!def?.id) throw new Error('it needs an "id"');
      if (ids.has(def.id)) throw new Error('another building already uses this id');
      ids.add(def.id);
      placed.push(await placeBuilding(area, def, options));
    } catch (err) {
      console.error(`[town] Building "${def?.id ?? '?'}" was left out: ${err.message}`);
    }
  }
  for (const sign of town.signs ?? []) addSign(area, sign.at, sign.text);
  // Checked last, once every building and sign is in place: any of them can end up in front of a door.
  for (const { label, door } of placed) {
    const [x, y] = [door.x, door.y + 1];
    if (area.isSolid(x, y)) {
      warn(`${label}: the tile below its door, (${x}, ${y}), is blocked by ${area.objectAt(x, y)?.label ?? area.tileAt(x, y).name}, so nobody can walk in`);
    }
  }
  const spawn = { at: [1, 1], facing: 'down', ...town.spawn };
  if (area.isSolid(...spawn.at)) warn(`the start position (${spawn.at.join(', ')}) is not a walkable tile`);
  return { area, buildings: placed, spawn };
}

// The footprint's tiles and its door, relative to the footprint's top-left corner.
function readFootprint(def) {
  if (!Array.isArray(def.footprint) || def.footprint.length === 0) throw new Error('it needs a "footprint"');
  const cells = [];
  const doors = [];
  def.footprint.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === '.') return;
      if (ch !== '#' && ch !== 'D') warn(`Building "${def.id}": footprint character "${ch}" should be "#", "D" or "."`);
      cells.push([i, j]);
      if (ch === 'D') doors.push([i, j]);
    });
  });
  if (doors.length === 0) throw new Error('its footprint needs a door tile marked "D"');
  const door = doors[doors.length - 1]; // the lowest one
  if (doors.length > 1) warn(`Building "${def.id}": its footprint has ${doors.length} doors ("D"); only the lowest one works`);
  return { cells, door, width: Math.max(...def.footprint.map((row) => row.length)), height: def.footprint.length };
}

/**
 * Draws a building's pictures (every one of its `sprites` and every animation frame) without placing it
 * anywhere: the town uses it, and so could a preview page.
 * Returns { pictures, picture (the first one's name), width, height, door (the doorway rectangle in the picture) }.
 */
export async function renderBuilding(def) {
  const footprint = readFootprint(def);
  const doorHeight = def.door?.height ?? 24;
  // The picture is centred on the footprint and stands on its bottom edge; it may be taller.
  const doorIn = (w, h) => ({
    x: footprint.door[0] * TILE - Math.round((footprint.width * TILE - w) / 2),
    y: h - (footprint.height - footprint.door[1]) * TILE + TILE - doorHeight,
    w: TILE,
    h: doorHeight,
  });
  const specs = def.sprites ?? { default: def.sprite };
  const names = Object.keys(specs);
  if (def.sprites && def.sprite) warn(`Building "${def.id}": it has both "sprite" and "sprites"; "sprites" wins`);
  const pictures = {};
  let size = null;
  for (const name of names) {
    const spec = specs[name];
    const draws = typeof spec?.draw === 'function';
    const width = draws ? (spec.width ?? footprint.width * TILE) : undefined;
    const height = draws ? (spec.height ?? footprint.height * TILE) : undefined;
    const picture = await makePicture(spec, { width, height }, draws ? { width, height, door: doorIn(width, height), state: name } : {});
    const { width: w, height: h } = picture.frames[0];
    if (!size) size = { width: w, height: h };
    else if (w !== size.width || h !== size.height) warn(`Building "${def.id}": its picture "${name}" is ${w} x ${h} but the first is ${size.width} x ${size.height}; draw them all the same size, so the door lines up`);
    pictures[name] = picture;
  }
  return { pictures, picture: names[0], width: size.width, height: size.height, door: doorIn(size.width, size.height), footprint };
}

async function placeBuilding(area, def) {
  const name = `Building "${def.id}"`;
  if (!Array.isArray(def.at) || def.at.length !== 2) throw new Error('it needs "at": [column, row]');
  const [bx, by] = def.at;
  const look = await renderBuilding(def);
  const { footprint } = look;
  const tiles = footprint.cells.map(([i, j]) => [bx + i, by + j]);
  const door = { x: bx + footprint.door[0], y: by + footprint.door[1] };
  for (const [x, y] of tiles) {
    if (!area.inBounds(x, y)) warn(`${name}: tile (${x}, ${y}) is outside the map`);
    else if (area.tileAt(x, y).solid) warn(`${name}: stands on ${area.tileAt(x, y).name} ("${area.charAt(x, y)}") at (${x}, ${y})`);
    else if (area.objectAt(x, y)) warn(`${name}: overlaps ${area.objectAt(x, y).label} at (${x}, ${y})`);
  }
  if (def.show && typeof def.show !== 'function') warn(`${name}: "show" should be a function, e.g. (state) => (state.open ? 'open' : 'closed')`);
  let state = {};
  try {
    state = structuredClone(def.state ?? {});
  } catch {
    warn(`${name}: its "state" should hold plain values only (numbers, text, true/false, lists), not functions`);
  }

  const bottom = (by + footprint.height) * TILE;
  const left = bx * TILE + Math.round((footprint.width * TILE - look.width) / 2);
  const building = area.add({
    kind: 'building',
    label: name,
    id: def.id,
    name: def.name ?? def.id,
    file: def.file, // which file in src/world/buildings/ it came from
    size: [footprint.width, footprint.height], // footprint, in tiles
    def,
    state, // remembered for the whole visit, and shared by the building's rooms
    pictures: look.pictures,
    picture: look.picture,
    show: typeof def.show === 'function' ? def.show : null,
    sprite: look.pictures[look.picture].frames[0], // the first picture: used for taps and the buildings table
    x: left,
    y: bottom - look.height,
    sortY: bottom,
    order: 0,
    tiles,
    solid: true,
    door,
    doorRect: look.door,
    doorOpen: 0,
    draw(ctx, camX, camY, tick, animate) {
      ctx.drawImage(frameOf(currentPicture(this), tick, animate), this.x - camX, this.y - camY);
      if (this.doorOpen > 0) drawDoorway(ctx, this, camX, camY);
    },
  });
  area.addWarp(door.x, door.y, { type: 'door', dir: 'up', building });
  if (def.sign) {
    const [ox, oy] = def.sign.at ?? [-1, 1]; // relative to the door: one left, one down
    addSign(area, [door.x + ox, door.y + oy], def.sign.text ?? building.name);
  }
  return building;
}

// The open door: a dark doorway that slides open in three steps.
function drawDoorway(ctx, building, camX, camY) {
  const { x, y, w, h } = building.doorRect;
  const stage = Math.min(3, Math.ceil(building.doorOpen * 3));
  ctx.fillStyle = '#1c120c';
  ctx.fillRect(building.x + x + 2 - camX, building.y + y + 2 - camY, Math.round(((w - 4) * stage) / 3), h - 2);
}

function addSign(area, at, text) {
  const [x, y] = at;
  if (!area.inBounds(x, y) || area.isSolid(x, y)) warn(`the sign at (${x}, ${y}) is outside the map or on a blocked tile`);
  const sprite = DECOR.sign.sprite();
  area.add({
    kind: 'sign',
    label: 'a sign',
    sprite,
    x: x * TILE,
    y: (y + 1) * TILE - sprite.height,
    sortY: (y + 1) * TILE,
    order: 0,
    tiles: [[x, y]],
    solid: true,
    text: toPages(text),
  });
}

/**
 * The inside of a building: a room with a back wall, a floor, an exit mat and decorations.
 * With `upstairs`, a second room above it (no exit mat), joined to the first by stairs.
 * `options.player` is the player's look (player.js), which characters (`npc`) can borrow.
 */
export async function buildInterior(building, options = {}) {
  const def = building.def.interior ?? {};
  const tiles = def.tiles ?? null;
  const area = await buildRoom(building, def, { id: `inside-${building.id}`, name: building.name, hasExit: true, tiles, options });
  if (def.upstairs) {
    try {
      const upstairsTiles = tiles || def.upstairs.tiles ? { ...tiles, ...def.upstairs.tiles } : null; // upstairs can use the ground floor's tiles too
      const upstairs = await buildRoom(building, def.upstairs, {
        id: `inside-${building.id}-upstairs`,
        name: `${building.name}, upstairs`,
        hasExit: false,
        tiles: upstairsTiles,
        options,
      });
      addStairs(building, area, def.stairs, upstairs, def.upstairs.stairs);
    } catch (err) {
      console.error(`[town] Building "${building.id}": its upstairs was left out: ${err.message}`);
    }
  } else if (def.stairs) {
    warn(`Building "${building.id}": its interior has "stairs" but no "upstairs" for them to lead to`);
  }
  return area;
}

async function buildRoom(building, def, { id, name, hasExit, tiles, options }) {
  let rows;
  let exit = null;
  if (Array.isArray(def.map)) {
    rows = def.map;
    if (hasExit) {
      exit = def.exit;
      if (!Array.isArray(exit)) throw new Error('a custom interior "map" also needs "exit": [column, row]');
    }
  } else {
    const [w, h] = def.size ?? [9, 7];
    let floor = FLOORS[def.floor ?? 'wood'] ?? def.floor;
    if (typeof floor !== 'string' || floor.length !== 1) {
      const known = Object.keys(FLOORS).map((f) => `"${f}"`).join(', ');
      warn(`Building "${building.id}": its interior floor "${def.floor}" is unknown (use ${known}, or one of its own tiles), so it gets wood`);
      floor = FLOORS.wood;
    }
    rows = ['W'.repeat(w), 'w'.repeat(w), ...Array.from({ length: Math.max(1, h - 2) }, () => floor.repeat(w))];
    if (hasExit) exit = [Math.floor(w / 2), rows.length - 1];
  }
  const area = new Area({ id, name, rows, border: ' ', tiles });
  area.camera = 'room';
  area.building = building;
  area.state = building.state;
  area.hooks = {};
  for (const hook of ROOM_HOOKS) {
    if (def[hook] === undefined) continue;
    if (typeof def[hook] === 'function') area.hooks[hook] = def[hook];
    else warn(`Building "${building.id}": "${hook}" should be a function`);
  }
  if (exit) {
    const [ex, ey] = exit;
    if (area.isSolid(ex, ey)) warn(`Building "${building.id}": its interior exit (${ex}, ${ey}) is on a blocked tile`);
    area.add({ kind: 'mat', label: 'the exit mat', layer: 'ground', sprite: DECOR.mat.sprite(), x: ex * TILE, y: ey * TILE, sortY: 0, order: 0, tiles: [], solid: false });
    area.exit = area.addWarp(ex, ey, { type: 'exit', dir: 'down', building });
    area.spawn = { x: ex, y: ey, facing: 'up' };
  }
  // A message can also be a function of the building's state: (ctx) => pages.
  area.message = typeof def.message === 'function' ? def.message : def.message ? toPages(def.message) : null;
  for (const item of def.decor ?? []) {
    try {
      await placeDecor(area, item, options);
    } catch (err) {
      console.error(`[town] Building "${building.id}": a decoration was left out: ${err.message}`);
    }
  }
  return area;
}

// A staircase stands against the back wall of each floor, 1 tile wide and 2 tall: in the top-right corner, unless
// `stairs: [column, row]` (its top tile) moves it. Walking up into one fades to the other floor, where the player
// steps off the other staircase. Placed after the decorations, so it is drawn over a wall-wide one.
function addStairs(building, below, belowAt, above, aboveAt) {
  if ([belowAt, aboveAt].some((at) => at !== undefined && !Array.isArray(at))) throw new Error('"stairs" needs [column, row]: its top tile');
  const [bx, by] = belowAt ?? [below.width - 1, 0];
  const [ax, ay] = aboveAt ?? [above.width - 1, 0];
  // Each warp sits on its staircase's lower tile; `at` is where the player arrives on the other floor.
  below.stairs = below.addWarp(bx, by + 1, { type: 'stairs', dir: 'up', goesUp: true, building, to: above, at: [ax, ay + 1] });
  above.stairs = above.addWarp(ax, ay + 1, { type: 'stairs', dir: 'up', goesUp: false, building, to: below, at: [bx, by + 1] });
  placeStairs(building, below, STAIRS.up(), 'the stairs up');
  placeStairs(building, above, STAIRS.down(), 'the stairs down');
}

function placeStairs(building, area, sprite, label) {
  const { x, y } = area.stairs;
  area.add({ kind: 'stairs', label, warp: area.stairs, sprite, x: x * TILE, y: (y - 1) * TILE, sortY: (y + 1) * TILE, order: 0, tiles: [[x, y - 1], [x, y]], solid: true });
  if (!area.inBounds(x, y)) {
    warn(`Building "${building.id}": ${label} at (${x}, ${y - 1}) are outside the room`);
  } else if (area.isSolid(x, y + 1)) {
    const blocker = area.objectAt(x, y + 1)?.label ?? area.tileAt(x, y + 1).name;
    warn(`Building "${building.id}": the tile in front of ${label}, (${x}, ${y + 1}), is blocked by ${blocker}, so nobody can use them`);
  }
}

// A character's four pictures (down, up, left, right), from text-art frames like the player's in player.js.
// Without its own `frames`, a character borrows the player's, recoloured with its `palette`.
function characterFrames(npc, player) {
  const frames = npc.frames ?? player?.frames;
  if (!frames?.down) throw new Error('a character needs frames with at least "down", or the player\'s look to borrow');
  const palette = { ...(npc.frames ? {} : player?.palette), ...npc.palette };
  const make = (rows) => (rows ? fromRows(rows, palette) : null);
  const down = make(frames.down);
  const up = make(frames.up) ?? down;
  const left = make(frames.left) ?? down;
  const right = frames.right ? make(frames.right) : frames.left ? flipX(left) : down;
  return { down, up, left, right };
}

async function placeDecor(area, item, options = {}) {
  const preset = item.type ? DECOR[item.type] : null;
  if (item.type && !preset) throw new Error(`there is no decoration type "${item.type}"`);
  if (!Array.isArray(item.at)) throw new Error('it needs "at": [column, row]');
  if (!preset && !item.sprite && !item.sprites && !item.npc) throw new Error('it needs a "sprite" (or "sprites", or a "type" such as "plant")');
  const [w, h] = item.size ?? preset?.size ?? [1, 1];
  const [x, y] = item.at;
  const size = { width: w * TILE, height: h * TILE };
  const [ox, oy] = item.offset ?? [0, 0];
  const lift = item.npc ? 3 : 0; // characters stand a few pixels up their tile, like the player
  const placed = (picture) => {
    const { width, height } = picture.frames[0];
    return { ...picture, x: x * TILE + Math.round((w * TILE - width) / 2) + ox, y: (y + h) * TILE - height + oy - lift };
  };

  const pictures = {};
  if (item.npc) {
    const frames = characterFrames(item.npc, options.player);
    for (const dir of ['down', 'up', 'left', 'right']) pictures[dir] = placed({ frames: [frames[dir]], frameTicks: 30, still: 0 });
  } else if (preset && !item.sprite && !item.sprites) {
    pictures.default = placed({ frames: [preset.sprite()], frameTicks: 30, still: 0 });
  } else {
    const specs = item.sprites ?? { default: item.sprite };
    for (const [name, spec] of Object.entries(specs)) pictures[name] = placed(await makePicture(spec, size, { ...size, state: name }));
  }
  if (item.show && !item.sprites) warn(`a decoration at (${x}, ${y}) has "show" but no "sprites" to choose from`);
  for (const field of ['ask', 'use', 'text']) {
    const value = item[field];
    if (field === 'ask' && value && typeof value !== 'function' && !value.question) warn(`a decoration at (${x}, ${y}) has an "ask" with no "question"`);
    if (field === 'use' && value && typeof value !== 'function') warn(`a decoration at (${x}, ${y}): "use" should be a function`);
  }

  const first = item.npc ? item.npc.facing ?? 'down' : Object.keys(pictures)[0];
  const bounds = Object.values(pictures);
  const tiles = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) tiles.push([x + i, y + j]);
  return area.add({
    kind: item.npc ? 'npc' : 'decor',
    label: item.label ?? (item.type ? `the ${item.type}` : item.npc ? 'a character' : 'a decoration'),
    pictures,
    picture: first,
    show: item.npc ? null : (item.show ?? null),
    facing: first,
    sprite: pictures[first].frames[0],
    // The box every picture fits in, so a bigger picture is never skipped as off screen.
    x: Math.min(...bounds.map((p) => p.x)),
    y: Math.min(...bounds.map((p) => p.y)),
    bounds: {
      right: Math.max(...bounds.map((p) => p.x + p.frames[0].width)),
      bottom: Math.max(...bounds.map((p) => p.y + p.frames[0].height)),
    },
    sortY: (y + h) * TILE,
    order: 0,
    tiles,
    solid: item.solid ?? preset?.solid ?? true,
    state: area.state ?? {},
    text: typeof item.text === 'function' ? item.text : item.text ? toPages(item.text) : null,
    ask: item.ask ?? null, // a question after the text: { question, choices, answers } (see README.md)
    use: item.use ?? null, // (ctx) => pages: runs every time it is read
    link: item.link ?? null, // { url, label, ask }: offers a link, e.g. to a paper
    game: item.game ?? null, // a chess game visitors can replay: { pgn, orientation, title, ask }
    arc: item.arc ?? null, // an ARC puzzle visitors can solve: { task, title, ask, onSolve }
    npc: item.npc ?? null, // a character who turns to face whoever talks to them
    draw(ctx, camX, camY, tick, animate) {
      const picture = this.npc ? this.pictures[this.facing] : currentPicture(this);
      ctx.drawImage(frameOf(picture, tick, animate), picture.x - camX, picture.y - camY);
    },
  });
}
