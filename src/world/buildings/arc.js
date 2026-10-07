import { ARC_COLORS } from '../../engine/arc.js';
import { makeCanvas } from '../../engine/pixels.js';
import { NOW, PAPER_LINK, PAPER_PAGES, TIMELINE, WHEN_I_STARTED } from './parts/arc-facts.js';
import { PUZZLES, fillColumns, fillRows, turnGrid, turntableSprite } from './parts/turntable.js';

// ARC-AGI ("Turn It Sideways"): my paper's first experiment as a game. The floor is an ARC puzzle and a little
// robot plays CodeT5+, the model we trained on it. One lever runs it all, one step per pull:
//   1. you try the floor puzzle yourself (on an ARC puzzle sheet, the exact grid on the floor), then the robot
//      solves it, and a line under the floor shows how it reads the grid: a row's two ends are close together;
//   2. the lever turns the floor 90 degrees: you try it again (still easy), and the robot is stumped, because in
//      its line a column's two ends are a whole 20 squares apart;
//   3. the lever changes how the robot tracks positions, and it solves the turned puzzle;
//   4. the lever puts everything back.
// Walking back in starts again. With reduced motion, the floor just changes, with no turning or scanning.

const TILE = 16;
const ORIGIN = [3, 3]; // the floor puzzle's top-left tile; it is 5 x 5
const ROBOT = [5, 2]; // the robot stands at the top of the puzzle, looking down at it

// The floor in its three states: sideways and solved (the room's own map), turned, then turned and solved.
const SIDEWAYS = fillRows(PUZZLES.floor);
const TURNED = turnGrid(PUZZLES.floor);
const TURNED_SOLVED = fillColumns(TURNED);
const JOINED = [...TURNED[0]].map((ch, x) => [x, ch]).filter(([x, ch]) => ch !== '0' && TURNED[TURNED.length - 1][x] === ch);

// Example pairs for the puzzle sheet: the same rule as the floor (fill in a row whose two ends match), 5 x 5 too.
const EXAMPLES = [
  ['10001', '00000', '40006', '00000', '70007'],
  ['60009', '00000', '30003', '00000', '10002'],
  ['40004', '00000', '90009', '00000', '60008'],
];
const TASKS = {
  sideways: { train: EXAMPLES.map((grid) => ({ input: grid, output: fillRows(grid) })), test: [{ input: PUZZLES.floor, output: SIDEWAYS }] },
  turned: {
    train: EXAMPLES.map((grid) => ({ input: turnGrid(grid), output: fillColumns(turnGrid(grid)) })),
    test: [{ input: TURNED, output: TURNED_SOLVED }],
  },
};
// The matching ends the robot has to link, as positions in its line of 25 squares (read row by row).
const ROW_ENDS = SIDEWAYS.flatMap((row, y) => (row[0] !== '0' && PUZZLES.floor[y][0] === PUZZLES.floor[y][4] ? [[y * 5, y * 5 + 4]] : []));
const COLUMN_ENDS = JOINED.map(([x]) => [x, 20 + x]);

// What the room remembers during a visit. `step` is how far the experiment has got (see the top of this file);
// `mode` is what the robot and the scoreboard show; `pulled` puts the lever down while a step runs.
const START = { step: 'start', mode: 'sideways', pulled: false };

// The robot: a big boxy head with a dark visor and two round eyes, an antenna, round hands and little feet.
// It plays CodeT5+ in the room; it is drawn from scratch, like no real mascot.
const ROBOT_PALETTE = {
  K: '#2a2430',
  H: '#c8d2e4',
  h: '#8e9ab2',
  V: '#1e2638',
  E: '#7FDBFF',
  e: '#e8f8ff',
  O: '#ff8a3c',
  B: '#5a84c8',
  b: '#3e64a8',
  P: '#ffd84a',
  A: '#aab4c8',
  W: '#3a3a44',
};
const ROBOT_FRAMES = {
  down: [
    '.......KK.......',
    '......KOOK......',
    '.......KK.......',
    '...KKKKKKKKKK...',
    '..KHHHHHHHHHHK..',
    '..KHVVVVVVVVHK..',
    '..KHVEeVVEeVHK..',
    '..KHVEEVVEEVHK..',
    '..KHVVVVVVVVHK..',
    '..KhHHHHHHHHhK..',
    '...KKKKKKKKKK...',
    '.KK.KBBBBBBK.KK.',
    'KAAKKBBPPBBKKAAK',
    'KAAKKBBBBBBKKAAK',
    '.KK.KbBBBBbK.KK.',
    '....KKKKKKKK....',
    '....KWWKKWWK....',
    '....KKKKKKKK....',
  ],
  up: [
    '.......KK.......',
    '......KOOK......',
    '.......KK.......',
    '...KKKKKKKKKK...',
    '..KHHHHHHHHHHK..',
    '..KHHHHHHHHHHK..',
    '..KHHhHhhHhHHK..',
    '..KHHhHhhHhHHK..',
    '..KHHHHHHHHHHK..',
    '..KhHHHHHHHHhK..',
    '...KKKKKKKKKK...',
    '.KK.KBBBBBBK.KK.',
    'KAAKKBBBBBBKKAAK',
    'KAAKKBhhhhBKKAAK',
    '.KK.KbBBBBbK.KK.',
    '....KKKKKKKK....',
    '....KWWKKWWK....',
    '....KKKKKKKK....',
  ],
  left: [
    '.......KK.......',
    '......KOOK......',
    '.......KK.......',
    '...KKKKKKKKKK...',
    '..KHHHHHHHHHHK..',
    '..KVVVVVHHHHHK..',
    '..KVEeVVHHHHHK..',
    '..KVEEVVHHhHHK..',
    '..KVVVVVHHHHHK..',
    '..KhHHHHHHHHhK..',
    '...KKKKKKKKKK...',
    '.....KBBBBBBK...',
    '....KKBBBBBBK...',
    '....KAABBBBBK...',
    '.....KbBBBBbK...',
    '.....KKKKKKKK...',
    '......KWWWWK....',
    '......KKKKKK....',
  ],
};

export default {
  id: 'arc',
  name: 'ARC-AGI',
  at: [21, 5],
  footprint: [
    '#####',
    '#####',
    '##D##',
  ],
  sprite: turntableSprite({ puzzle: PUZZLES.floor, cell: 5, look: 'dark', arrow: true, height: 74 }), // as tall as Técnico's cap
  door: { height: 20 },
  sign: { text: ['ARC-AGI research', 'The puzzle that stumped an AI. Come in and try it yourself!'], at: [1, 1] }, // right of the door, outside the little square,
  state: { ...START },

  interior: {
    map: [
      'WWWWWWWWWWW',
      'wwwwwwwwwww',
      '___________',
      ...PUZZLES.floor.map((row) => `___${row}___`), // the puzzle, unsolved
      '___________',
    ],
    exit: [5, 8],
    message: [
      'ARC-AGI is a set of picture puzzles: easy for people, hard for AI!',
      'This room is the first experiment in my ARC paper, as a game.',
      'The floor is an ARC puzzle. The robot is the AI model we trained.',
      'Pull the lever on the left: you go first, then the robot.',
    ],
    // Every visit starts from the beginning.
    onEnter: (ctx) => reset(ctx),
    // The robot's mood, over its head: sparks while it is stumped, a twinkle once it has solved the turned puzzle.
    overlay: (ctx, g, view) => drawMood(g, view, ctx.state.mode, ctx.reducedMotion ? 0 : Math.floor(ctx.tick / 30) % 2),
    decor: [
      {
        at: [1, 0],
        size: [2, 2],
        offset: [0, -6],
        label: 'the chessboard picture',
        sprite: { width: 28, height: 24, draw: drawChessboard },
        text: [
          'A chessboard. Read row by row from a8, e4 is square 37.',
          'Chess players just say e4: a column and a row.',
          "That's 2D encoding, the idea at the heart of my paper!",
        ],
      },
      {
        at: [3, 0],
        size: [5, 2],
        offset: [0, -6],
        label: 'the scoreboard',
        sprites: Object.fromEntries(['sideways', 'turned', 'fixed'].map((mode) => [mode, { width: 76, height: 26, draw: drawScoreboard }])),
        show: (state) => state.mode,
        text: (ctx) => SCOREBOARD[ctx.state.mode],
      },
      {
        at: [8, 0],
        size: [2, 2],
        offset: [0, -6],
        label: 'the timeline plaque',
        sprite: { width: 28, height: 24, draw: drawTimeline },
        text: [TIMELINE[0].pages[0], ...WHEN_I_STARTED, ...NOW],
      },
      {
        at: ROBOT,
        label: 'the robot',
        npc: { facing: 'down', frames: ROBOT_FRAMES, palette: ROBOT_PALETTE },
        text: (ctx) => ROBOT_LINES[ctx.state.step],
      },
      {
        // The one control in the room: each pull runs the next step of the experiment.
        at: [1, 5],
        label: 'the lever',
        sprites: { up: { width: 16, height: 23, draw: drawLever }, down: { width: 16, height: 23, draw: drawLever } },
        show: (state) => (state.pulled ? 'down' : 'up'),
        text: (ctx) => LEVER[ctx.state.step].text,
        ask: (ctx) => LEVER[ctx.state.step].ask,
      },
      {
        at: [10, 2],
        label: 'the lectern',
        sprite: { width: 16, height: 28, draw: drawLectern },
        text: [...PAPER_PAGES.intro, ...PAPER_PAGES.finding, ...PAPER_PAGES.where],
        link: PAPER_LINK,
      },
      { type: 'plant', at: [0, 2] },
      { type: 'plant', at: [0, 7] },
      { type: 'plant', at: [10, 7] },
    ],
  },
};

// ---------------------------------------------------------------- the words

const SKIP = 'Skip to the robot';

// What the lever says and asks at each step.
const LEVER = {
  start: {
    text: ["A lever. Each pull runs the next step of my paper's experiment.", 'First, the puzzle on the floor. Can you find its rule?'],
    ask: { question: 'Do you want to try the puzzle yourself first?', choices: ['Yes', SKIP], answers: [(c) => tryPuzzle(c, 'sideways'), (c) => c.run(robotSideways(false))] },
  },
  sideways: {
    text: ['The robot solved the puzzle. Next, the lever turns it 90 degrees.'],
    ask: { question: 'Pull the lever?', answers: [(c) => c.run(turnPuzzle), ['OK! Pull it whenever you are ready.']] },
  },
  turned: {
    text: ['The puzzle is turned 90 degrees. Now the lines run up and down.'],
    ask: { question: 'Do you want to try the turned puzzle first?', choices: ['Yes', SKIP], answers: [(c) => tryPuzzle(c, 'turned'), (c) => c.run(robotTurned(false))] },
  },
  stumped: {
    text: ['Next, the lever changes how the robot keeps track of positions.'],
    ask: { question: 'Pull the lever?', answers: [(c) => c.run(fixRobot), ['OK! Pull it whenever you are ready.']] },
  },
  fixed: {
    text: ['That was the whole experiment! The lever can start it again.'],
    ask: { question: 'Start again?', answers: [(c) => c.run(startAgain), ['OK! Have a look at the lectern too.']] },
  },
};

const ROBOT_LINES = {
  start: ["Beep boop! I'm a cartoon of CodeT5+, the AI model in the paper.", 'Pull the lever on the left. You try the puzzle first, then me!'],
  sideways: ['Rows with matching ends? I fill them in! I scored about 61.', 'Go on, pull the lever to turn the puzzle. I can take it!'],
  turned: ['The puzzle turned! Pull the lever to try it, then it is my turn.'],
  stumped: ['Bzzt! I read the floor row by row, as one long line.', "In my line, a column's two ends are far apart. I scored about 0!"],
  fixed: ['Beep! Now I link the two ends of each column.', 'With that change, I scored about 71 on turned puzzles!'],
};

const SCOREBOARD_INTRO = "CodeT5+'s scores over 10 rounds of training, from my paper.";
const SCOREBOARD = {
  sideways: [SCOREBOARD_INTRO, 'The pink line is the puzzle side to side. It climbs to about 61.'],
  turned: [SCOREBOARD_INTRO, 'Pink is side to side: about 61. Green is turned: flat at about 0.'],
  fixed: [SCOREBOARD_INTRO, 'Pink is side to side: about 61. Green is turned: about 0.', 'Yellow is turned, with our change. It climbs to about 71!'],
};

const SIDEWAYS_PAGES = [
  'Beep! The robot plays CodeT5+, the AI model we trained in my paper.',
  'It learned this puzzle side to side, with a score of about 61.',
  'The line under the floor shows how it reads the grid: row by row.',
  "In that line, a row's two ends are just 4 squares apart. Easy!",
  'Now pull the lever again: it turns the puzzle 90 degrees.',
];

const TURNED_PAGES = [
  'Bzzt! The robot is stumped. On turned puzzles, it scored about 0.',
  'It still reads the grid row by row, as one long line.',
  "Look at the line: a column's two ends are 20 squares apart in it.",
  'The model favours squares close together, so it misses the link.',
  'Pull the lever again: it changes how the robot tracks positions.',
];

const FIX_PAGES = [
  'Click! Now the robot links the two ends of each column.',
  'That was our change to CodeT5+. Turned, it rose to about 71!',
  'Its sense of position was built in deep, so it was hard to change.',
  'So I built small models that know each square by its row and column.',
  'It is all in my paper, on the lectern by the wall.',
];

// ---------------------------------------------------------------- the scenes

function reset(ctx) {
  ctx.resetTiles();
  Object.assign(ctx.state, START);
}

function setPuzzle(ctx, grid) {
  grid.forEach((row, y) => [...row].forEach((ch, x) => ctx.setTile(ORIGIN[0] + x, ORIGIN[1] + y, ch)));
}

// The puzzle sheet, with the exact grid that is on the floor; when it closes, the robot has its go.
function tryPuzzle(ctx, which) {
  const turned = which === 'turned';
  return ctx.show('arc', {
    task: TASKS[which],
    title: turned ? 'The floor puzzle, turned' : 'The floor puzzle',
    intro: 'Each example shows a grid and its answer. Find the rule, then paint the answer for the grid on the floor and press Check.',
    solvedText: 'Solved! Close this sheet to watch the robot try the same puzzle.',
    onClose: (c, solved) => c.run(turned ? robotTurned(solved) : robotSideways(solved)),
  });
}

// The robot solves the puzzle side to side, then the line under the floor shows why that was easy.
function robotSideways(solvedByYou) {
  return function* (ctx) {
    ctx.state.pulled = true;
    if (solvedByYou) {
      ctx.say(['You got it: a row whose two ends match gets filled in!', 'Now watch the robot try the same puzzle.']);
      yield;
    }
    ctx.announce('The robot reads the floor, one square after another, row by row.');
    if (!ctx.reducedMotion) yield* readRows(ctx);
    setPuzzle(ctx, SIDEWAYS);
    ctx.state.step = 'sideways';
    ctx.state.pulled = false;
    ctx.overlay((g, view) => drawLine(g, view, SIDEWAYS, ROW_ENDS));
    ctx.say(SIDEWAYS_PAGES);
    yield; // a scene waits here while its text is showing
    ctx.overlay(null);
  };
}

// The lever turns the floor a quarter turn, and offers the turned puzzle.
function* turnPuzzle(ctx) {
  ctx.state.pulled = true;
  setPuzzle(ctx, PUZZLES.floor);
  ctx.announce('The lever turns the floor puzzle a quarter turn.');
  if (!ctx.reducedMotion) {
    yield* ctx.wait(12);
    yield* spin(ctx, PUZZLES.floor);
  }
  setPuzzle(ctx, TURNED);
  ctx.state.step = 'turned';
  ctx.state.pulled = false;
  ctx.ask({
    text: ['Clunk! The same puzzle, turned 90 degrees. Still easy, right?'],
    question: 'Do you want to try it first?',
    choices: ['Yes', SKIP],
    answers: [(c) => tryPuzzle(c, 'turned'), (c) => c.run(robotTurned(false))],
  });
}

// The robot reads the turned floor and is stumped; the line shows why.
function robotTurned(solvedByYou) {
  return function* (ctx) {
    ctx.state.pulled = true;
    if (solvedByYou) {
      ctx.say(['Right! Now it is the columns that get filled in.', 'Now watch the robot try it.']);
      yield;
    }
    ctx.announce('The robot reads the turned floor, row by row.');
    if (!ctx.reducedMotion) yield* readRows(ctx);
    ctx.state.step = 'stumped';
    ctx.state.mode = 'turned';
    ctx.state.pulled = false;
    if (!ctx.reducedMotion) yield* ctx.wait(24);
    ctx.overlay((g, view) => drawLine(g, view, TURNED, COLUMN_ENDS));
    ctx.say(TURNED_PAGES);
    yield;
    ctx.overlay(null);
  };
}

// The lever changes the robot: it links the two ends of each column, and fills them in.
function* fixRobot(ctx) {
  ctx.state.pulled = true;
  ctx.announce('The lever clicks. The robot links the two ends of each column.');
  if (!ctx.reducedMotion) {
    yield* ctx.wait(12);
    yield* linkEnds(ctx);
  }
  setPuzzle(ctx, TURNED_SOLVED);
  ctx.state.step = 'fixed';
  ctx.state.mode = 'fixed';
  ctx.state.pulled = false;
  if (!ctx.reducedMotion) yield* ctx.wait(20);
  ctx.say(FIX_PAGES);
  yield;
}

function* startAgain(ctx) {
  reset(ctx);
  ctx.announce('The puzzle is back to the start.');
  ctx.say(['Clunk! The floor puzzle is back to the start.']);
  yield;
}

// The floor lifts and turns a quarter turn clockwise, drawn over the room (it shrinks a little mid-turn, so it
// never covers the things around it).
function* spin(ctx, grid) {
  const plate = plateOf(grid);
  const ticks = 30;
  let angle = 0;
  ctx.overlay((g, view) => drawSpin(g, view, plate, angle));
  for (let t = 1; t <= ticks; t++) {
    angle = ((1 - Math.cos((Math.PI * t) / ticks)) / 2) * (Math.PI / 2);
    yield;
  }
  ctx.overlay(null);
}

// The robot reads the floor the way a language model reads a grid: one square after another, row by row.
function* readRows(ctx) {
  let cell = 0;
  ctx.overlay((g, view) => drawLook(g, view, ORIGIN[0] + (cell % 5), ORIGIN[1] + Math.floor(cell / 5)));
  for (cell = 0; cell < 25; cell++) yield* ctx.wait(3);
  ctx.overlay(null);
}

// The changed robot links each column's matching ends, then fills the column in, top to bottom.
function* linkEnds(ctx) {
  let grown = 0;
  ctx.overlay((g, view) => drawLinks(g, view, grown));
  for (grown = 1; grown <= 4; grown++) yield* ctx.wait(6);
  for (let y = 1; y < TURNED.length - 1; y++) {
    for (const [x, ch] of JOINED) ctx.setTile(ORIGIN[0] + x, ORIGIN[1] + y, ch);
    yield* ctx.wait(8);
  }
  ctx.overlay(null);
}

// ---------------------------------------------------------------- drawing over the room

const SEAM = '#333333';

// The floor puzzle as one picture, the way its tiles look (ARC colours, black drawn a little lighter, thin seams).
function plateOf(grid) {
  const canvas = makeCanvas(grid[0].length * TILE, grid.length * TILE);
  const g = canvas.getContext('2d');
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      g.fillStyle = ch === '0' ? '#141414' : ARC_COLORS[Number(ch)];
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
      g.fillStyle = SEAM;
      g.fillRect(x * TILE, y * TILE + TILE - 1, TILE, 1);
      g.fillRect(x * TILE + TILE - 1, y * TILE, 1, TILE);
    }),
  );
  return canvas;
}

function drawSpin(g, view, plate, angle) {
  const x = ORIGIN[0] * TILE - view.camX;
  const y = ORIGIN[1] * TILE - view.camY;
  const half = plate.width / 2;
  g.fillStyle = '#1c140e'; // the pit under the floor
  g.fillRect(x, y, plate.width, plate.height);
  const scale = 1 / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
  g.save();
  g.translate(x + half, y + half);
  g.rotate(angle);
  g.scale(scale, scale);
  g.drawImage(plate, -half, -half);
  g.restore();
}

// A dotted beam from the robot's eyes to the square it is reading, which gets a bright frame.
function drawLook(g, view, tx, ty) {
  const [ex, ey] = [ROBOT[0] * TILE + 8 - view.camX, ROBOT[1] * TILE + 2 - view.camY];
  const [x, y] = [tx * TILE - view.camX, ty * TILE - view.camY];
  const steps = Math.max(Math.abs(x + 8 - ex), Math.abs(y + 8 - ey));
  g.fillStyle = '#7FDBFF';
  for (let i = 4; i <= steps; i += 3) g.fillRect(Math.round(ex + ((x + 8 - ex) * i) / steps), Math.round(ey + ((y + 8 - ey) * i) / steps), 1, 1);
  frame(g, x, y, '#ffffff');
}

// Dotted links growing between the two ends of each matching column; the ends get a bright frame.
function drawLinks(g, view, grown) {
  for (const [column] of JOINED) {
    const x = (ORIGIN[0] + column) * TILE - view.camX;
    const top = ORIGIN[1] * TILE - view.camY;
    const bottom = (ORIGIN[1] + TURNED.length - 1) * TILE - view.camY;
    const reach = ((bottom - top - TILE) / 2) * (grown / 4);
    g.fillStyle = '#ffffff';
    for (let d = 1; d <= reach; d += 3) {
      g.fillRect(x + 7, top + TILE + d, 2, 1);
      g.fillRect(x + 7, bottom - 1 - d, 2, 1);
    }
    frame(g, x, top, '#ffffff');
    frame(g, x, bottom, '#ffffff');
  }
}

// The floor as the robot reads it: its 25 squares in one line under the floor, with a gap between rows, and the
// pairs of matching ends it has to link joined by a dotted arc (and framed on the floor too).
function drawLine(g, view, grid, pairs) {
  const cells = grid.join('');
  const cell = 5;
  const x0 = 9 - view.camX;
  const y0 = 8 * TILE + 7 - view.camY;
  const xOf = (i) => x0 + i * (cell + 1) + Math.floor(i / 5) * 2;
  const width = xOf(24) + cell + 2 - x0 + 2;
  g.fillStyle = '#1c140e';
  g.fillRect(x0 - 2, y0 - 6, width, cell + 9);
  [...cells].forEach((ch, i) => {
    g.fillStyle = ch === '0' ? '#3a3a40' : ARC_COLORS[Number(ch)];
    g.fillRect(xOf(i), y0, cell, cell);
  });
  g.fillStyle = '#ffffff';
  for (const [a, b] of pairs) {
    for (const i of [a, b]) {
      g.fillRect(xOf(i), y0 - 2, cell, 1); // a tick over each end
      frame(g, (ORIGIN[0] + (i % 5)) * TILE - view.camX, (ORIGIN[1] + Math.floor(i / 5)) * TILE - view.camY, '#ffffff');
    }
    for (let x = xOf(a) + 2; x <= xOf(b) + 2; x += 2) g.fillRect(x, y0 - 4, 1, 1); // the link between them
  }
}

function frame(g, x, y, color) {
  g.fillStyle = color;
  g.fillRect(x, y, TILE, 1);
  g.fillRect(x, y + TILE - 1, TILE, 1);
  g.fillRect(x, y, 1, TILE);
  g.fillRect(x + TILE - 1, y, 1, TILE);
}

// Sparks at both sides of the robot's head while it is stumped; a twinkle once it has solved the turned puzzle.
const SPARK = [[1, 0], [0, 1], [1, 2], [2, 3], [1, 4], [0, 5]];
const TWINKLE = [[[2, 0], [2, 1], [0, 2], [1, 2], [3, 2], [4, 2], [2, 3], [2, 4]], [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2]]];

function drawMood(g, view, mode, frameIndex) {
  const x = ROBOT[0] * TILE - view.camX;
  const y = ROBOT[1] * TILE - view.camY;
  if (mode === 'turned') {
    const sides = frameIndex ? [[-2, -1], [15, -3]] : [[-2, -4], [15, 0]];
    g.fillStyle = '#FFDC00';
    for (const [sx, sy] of sides) for (const [dx, dy] of SPARK) g.fillRect(x + sx + dx, y + sy + dy, 1, 1);
  } else if (mode === 'fixed') {
    const [cx, cy] = frameIndex ? [x + 14, y - 5] : [x + 13, y - 6];
    g.fillStyle = '#FFDC00';
    for (const [dx, dy] of TWINKLE[frameIndex]) g.fillRect(cx + dx, cy + dy, 1, 1);
  }
}

// ---------------------------------------------------------------- pictures

const OUTLINE = '#2a2430';
const WOOD = { dark: '#5a3420', base: '#7a4a2a', light: '#a06a40', top: '#c08050', pale: '#d8a066' };
const METAL = { dark: '#3a3e48', base: '#4a4e5a', mid: '#6a6e7a', light: '#8a92a4', pale: '#aab2c4', shine: '#c8d0de' };

// The scoreboard: CodeT5+'s scores over 10 epochs as lines (chart readings from my paper, Figures 3 and 5), with no
// numbers. Pink is the puzzle sideways; green, turned; yellow, turned with our change. Each picture adds a line.
const LINES = [
  { values: [7, 6, 3, 3, 38, 20, 39, 24, 42, 61], color: '#ff7eb6', across: true },
  { values: [0, 0, 0, 0, 3, 0, 0, 0, 0, 0], color: '#2ECC40' },
  { values: [32, 51, 59, 44, 61, 66, 69, 59, 70.5, 71], color: '#FFDC00' },
];

function drawScoreboard(p, { state }) {
  p.rect(0, 0, 76, 26, '#8c8c96').box(1, 1, 74, 24, '#c8c8d0').rect(2, 2, 72, 22, '#1e2030');
  p.vline(6, 4, 18, '#4a4e66').hline(6, 21, 52, '#4a4e66');
  const shown = LINES.slice(0, { sideways: 1, turned: 2, fixed: 3 }[state]);
  shown.forEach(({ values, color, across }, i) => {
    const points = values.map((v, epoch) => [8 + Math.round(epoch * 5.4), 20 - Math.round((v / 100) * 16)]);
    for (let k = 1; k < points.length; k++) line(p, ...points[k - 1], ...points[k], color);
    // A key on the right: a tiny puzzle with a line across or down, in the line's colour.
    const ky = 4 + i * 6;
    p.hline(61, ky + 2, 3, color).rect(66, ky, 5, 5, '#000000');
    if (across) p.hline(66, ky + 2, 5, color);
    else p.vline(68, ky, 5, color);
  });
}

// A chessboard in a gold frame, with e4 marked (the 37th square, read row by row from a8).
function drawChessboard(p) {
  p.rect(0, 0, 28, 24, '#c89838').hline(0, 23, 28, '#9a7028').vline(27, 0, 24, '#9a7028');
  p.rect(2, 2, 24, 20, '#2f5d50');
  p.checker(6, 4, 8, 8, 2, 2, '#f0d9b5', '#b58863');
  p.rect(14, 12, 2, 2, '#FF4136');
}

// ARC-AGI-1's best scores over the years, rising towards the dotted line of people. No numbers.
function drawTimeline(p) {
  p.rect(0, 0, 28, 24, '#5a3a22').box(1, 1, 26, 22, '#c89838').rect(2, 2, 24, 20, '#26324e');
  for (let x = 4; x < 24; x += 2) p.px(x, 5, '#e8e8f0');
  [20, 30, 55, 76, 98].forEach((score, i) => {
    const h = Math.round((score / 100) * 14);
    p.rect(5 + i * 4, 20 - h, 3, h, i === 4 ? '#7FDBFF' : '#0074D9');
  });
}

// The lever: a toy gearbox on a stand (teal, like the turntable outside) with a handle on its side. The handle is
// up, ready, and goes down while a step runs.
function drawLever(p, { state }) {
  p.rect(1, 19, 11, 3, METAL.dark).hline(1, 19, 11, METAL.mid);
  p.rect(4, 14, 4, 5, METAL.base).vline(4, 14, 5, METAL.mid);
  p.rect(1, 6, 10, 9, '#38a098').rect(1, 6, 10, 2, '#6cd0c8').vline(10, 8, 7, '#226a66').hline(1, 14, 10, '#226a66');
  p.box(3, 8, 6, 6, '#ffe68e').px(3, 8, '#38a098').px(8, 8, '#38a098').px(3, 13, '#38a098').px(8, 13, '#38a098'); // a yellow ring
  p.rect(11, 10, 1, 2, METAL.dark);
  const up = state === 'up';
  p.rect(12, up ? 2 : 10, 2, 10, METAL.base).vline(12, up ? 2 : 10, 10, METAL.mid);
  p.rect(12, up ? 1 : 18, 3, 3, '#e8503a').px(12, up ? 1 : 18, '#ff8e6e');
  p.outline(OUTLINE);
}

// A lectern holding my paper open: a page with the turned puzzle on it, and a page of text.
function drawLectern(p) {
  p.rect(3, 25, 10, 2, WOOD.dark);
  p.rect(6, 12, 4, 13, WOOD.base).vline(6, 12, 13, WOOD.light);
  p.rect(1, 9, 14, 4, WOOD.top).hline(1, 9, 14, WOOD.pale).hline(1, 12, 14, WOOD.dark);
  p.rect(2, 2, 6, 8, '#fafaf4').rect(8, 2, 6, 8, '#eeeee6');
  p.rect(3, 3, 4, 4, '#3a3a40').vline(4, 3, 4, '#FF4136');
  p.hline(9, 4, 4, '#b8b8c8').hline(9, 6, 4, '#b8b8c8').hline(9, 8, 3, '#b8b8c8').hline(3, 8, 4, '#b8b8c8');
  p.outline(OUTLINE);
}

// A straight 1-pixel line (Bresenham's algorithm), for the scoreboard's lines.
function line(p, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    p.px(x0, y0, color);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}
