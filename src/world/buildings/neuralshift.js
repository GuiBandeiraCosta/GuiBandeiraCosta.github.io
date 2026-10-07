import { hash } from '../../engine/pixels.js';
import { PAPER_LINK, PAPER_PAGES } from './parts/arc-facts.js';
import { drawKeycap } from './parts/keycap.js';
import { COMPANY, CV, ENTRY, RUN_TIP } from './parts/ns-facts.js';

// NeuralShift ("Shift HQ"): a giant Shift key, in slate blue (Shift is also this game's run key). Inside, an office
// where every line of my CV is a quick toy: a benchmark board you can run, a blinking search server, a stack of
// shipping containers (Docker, and the move to Spain), a vending machine with two versions (my versioned APIs),
// a tower of glowing layers, and colleagues who turn to talk. My desk, straight up from the mat, has the headline.

// The key's colours: slate blue with an ivory arrow (parts/keycap.js draws it).
const SLATE = {
  top: '#aab9d0', dish: '#a0b0c9', lit: '#bdcadd', shade: '#7e90ad', skirt: '#94a6c1', skirtLine: '#8597b3',
  line: '#1f2638', accent: '#f4efe2', door: '#26324e', handle: '#d4b06a',
};
const key = (pressed) => ({ width: 88, height: 74, draw: (p, info) => drawKeycap(p, info, SLATE, { pressed }) });

// The board's pictures: all lights off, four steps of a run (amber: being checked, green: passed), and all passed.
const BOARD_STATES = ['idle', 'run1', 'run2', 'run3', 'run4', 'pass'];

export default {
  id: 'neuralshift',
  name: 'NeuralShift',
  at: [15, 5],
  footprint: [
    '#####',
    '#####',
    '##D##',
  ],
  sprites: { up: key(false), pressed: key(true) },
  show: (state, building) => (building.doorOpen > 0 ? 'pressed' : 'up'), // the key dips while its door is open
  door: { height: 24 },
  sign: { text: [`${COMPANY.name}, ${COMPANY.city}`, `Where I was an AI Researcher / Engineer, 2024-2026!`], at: [-1, 1] },
  state: { bench: 'idle', biscuit: 'empty' }, // the benchmark board's lights, and what the vending machine dropped

  interior: {
    // A wooden floor with a rug under my desk (r, this room's own tile: its border follows the rug's edges).
    map: [
      'WWWWWWWWWWW',
      'wwwwwwwwwww',
      '___________',
      '___________',
      '___rrrrrr__',
      '___rrrrrr__',
      '___rrrrrr__',
      '___________',
      '___________',
    ],
    exit: [5, 8],
    tiles: { r: { name: 'rug', edges: (ch) => ch !== 'r', draw: drawRug } },
    message: [...ENTRY, 'Have a look around: everything in this office does something!'],
    decor: [
      // The back wall, each read from the row below it.
      { at: [1, 0], size: [2, 2], offset: [0, -10], label: 'the clock', sprite: { width: 14, height: 14, draw: drawClock } },
      {
        at: [3, 0],
        size: [5, 2],
        offset: [0, -6],
        label: 'the benchmark board',
        sprites: Object.fromEntries(BOARD_STATES.map((name) => [name, { width: 76, height: 24, draw: (p) => drawBoard(p, name) }])),
        show: (state) => state.bench,
        text: [...CV.benchmarks, 'Each light on this board is one test question.'],
        ask: { question: 'Run the benchmark?', answers: [(ctx) => ctx.run(runBenchmark), ['OK! The lights will wait for you.']] },
      },
      {
        at: [9, 0],
        size: [1, 2],
        offset: [0, -6],
        label: 'the framed paper',
        sprite: { width: 14, height: 16, draw: drawFramedPaper },
        text: [...PAPER_PAGES.intro, PAPER_PAGES.where[1]],
        link: PAPER_LINK,
      },

      // The toys, one per line of my CV.
      {
        at: [0, 2],
        label: 'the server rack',
        sprite: { width: 16, height: 30, frames: 4, frameTicks: 30, draw: drawRack }, // its lights blink (still for reduced motion)
        text: [...CV.vespa, 'I added hand-made ranking penalties in it, so weak matches sink.'],
      },
      {
        at: [10, 2],
        label: 'the shipping containers',
        sprite: { width: 16, height: 30, draw: drawContainers },
        text: ['Shipping containers! Docker packs software the same way.', 'That way, it runs the same on any machine.', ...CV.spain],
      },
      {
        // My versioned REST APIs, explained with biscuits: whichever version you pick, you get a biscuit.
        at: [10, 4],
        label: 'the vending machine',
        sprites: { empty: vending('empty'), plain: vending('plain'), sprinkles: vending('sprinkles') },
        show: (state) => state.biscuit,
        text: 'A vending machine with two buttons: v1 and v2.',
        ask: {
          question: 'Which version?',
          choices: ['v1', 'v2'],
          answers: [
            (ctx) => {
              ctx.state.biscuit = 'plain';
              return ['Clunk! A plain biscuit. v1 still works, even now that v2 is out.', ...CV.apis];
            },
            (ctx) => {
              ctx.state.biscuit = 'sprinkles';
              return ['Clunk! A biscuit with sprinkles: the same order, a newer recipe.', ...CV.apis];
            },
          ],
        },
      },
      {
        at: [8, 3],
        label: 'the language-model tower',
        sprite: { width: 16, height: 32, frames: 6, frameTicks: 30, draw: drawTower }, // a glow climbs its layers
        text: [CV.paper[0], 'Each glowing floor is one layer. My paper tried 1, 4 and 6 layers.', ...CV.paper.slice(1)],
      },
      {
        // The headline, straight up the aisle from the mat: walking in and up reads it.
        at: [5, 5],
        size: [2, 1],
        label: 'my desk',
        sprite: { width: 32, height: 28, draw: drawMyDesk },
        text: ['My desk! This is where I worked on our search.', ...CV.accuracy, ...CV.how, ...CV.rag],
      },
      { at: [1, 5], label: 'the annotation desk', sprite: { width: 16, height: 20, draw: drawLabellingDesk }, text: CV.annotators },
      {
        // Two colleagues (not real people) who turn to face you.
        at: [2, 5],
        label: 'a student annotator',
        npc: { facing: 'left', palette: { H: '#3e3648', C: '#a070c8', c: '#7a50a0', P: '#4a4a56', p: '#3a3a44' } },
        text: ["Hi! I write the right answers to the benchmark's test questions.", 'Two of us answer each one. When we agree, it counts!'],
      },
      {
        at: [9, 6],
        label: 'a developer',
        npc: { facing: 'down', palette: { H: '#b8783c', C: '#3a7ac8', c: '#2c5e9e', P: '#5a5a6a', p: '#46465a' } },
        text: "I'm trying the new API version. The old one keeps working, phew!",
      },
      { at: [4, 8], label: 'the sign by the door', sprite: { width: 14, height: 16, draw: drawShiftSign }, text: RUN_TIP },
      { type: 'plant', at: [10, 7] },
      { type: 'plant', at: [0, 8] },
    ],
  },
};

// ---------------------------------------------------------------- the benchmark

// Running it: the lights check the questions from left to right, half a second a step, then all pass.
// Visitors who prefer reduced motion get the result at once.
function* runBenchmark(ctx) {
  ctx.announce('The benchmark is running: the lights check one test question each, from left to right.');
  if (!ctx.reducedMotion) {
    for (const step of BOARD_STATES.slice(1, 5)) {
      ctx.state.bench = step;
      yield* ctx.wait(30);
    }
  }
  ctx.state.bench = 'pass';
  ctx.say(['All ten lights are green: every test question passes!', 'That is how we knew a change really helped.']);
}

// ---------------------------------------------------------------- colours

const OUTLINE = '#2a2430';
const WOOD = { dark: '#5a3420', base: '#7a4a2a', top: '#c08050', pale: '#d8a066' };
const GOLD = { light: '#fde68e', base: '#f2c43c', dark: '#c08a1e' };
const PAPER = '#fafaf4';
const INK = '#b8b8c8'; // lines of text, too small to read
const STEEL = { light: '#7a808c', base: '#4a4f5a', dark: '#33363e', deep: '#262830' };
const LIGHT = {
  off: { base: '#34405c', light: '#46547a' },
  amber: { base: '#f2b43c', light: '#ffe08a' },
  green: { base: '#5cd060', light: '#c8ffc0' },
};

// ---------------------------------------------------------------- the back wall

// The benchmark board: ten lights in a row, one per test question, and a progress track above them.
function drawBoard(p, state) {
  const W = 76;
  const done = { idle: 0, run1: 0, run2: 3, run3: 6, run4: 9, pass: 10 }[state]; // lights already green
  const checking = { idle: 0, run1: 3, run2: 3, run3: 3, run4: 1, pass: 0 }[state]; // lights being checked (amber)
  p.rect(0, 0, W, 21, STEEL.base).hline(0, 0, W, STEEL.light).vline(W - 1, 1, 20, STEEL.dark).hline(0, 20, W, STEEL.dark);
  p.rect(2, 2, W - 4, 17, '#1e2a44');
  p.rect(4, 5, 68, 2, '#2c3a5c').rect(4, 5, Math.round((68 * done) / 10), 2, LIGHT.green.base);
  for (let i = 0; i < 10; i++) {
    const x = 4 + i * 7;
    const light = i < done ? LIGHT.green : i < done + checking ? LIGHT.amber : LIGHT.off;
    p.rect(x + 1, 10, 3, 5, light.base).rect(x, 11, 5, 3, light.base).px(x + 1, 11, light.light); // a round light
  }
  p.rect(14, 21, 4, 3, STEEL.dark).rect(58, 21, 4, 3, STEEL.dark); // the brackets holding it on the wall
}

// A round wall clock, with no numbers on its face: just four marks and its two hands.
function drawClock(p) {
  p.ellipse(7, 7, 6, 6, '#5a3a22').ellipse(7, 7, 5, 5, '#fbf8ee');
  for (const [x, y] of [[7, 3], [11, 7], [7, 11], [3, 7]]) p.px(x, y, '#8a8478');
  p.vline(7, 4, 4, OUTLINE).px(6, 8, OUTLINE).px(5, 9, OUTLINE).px(7, 7, '#d84040');
}

// My ARC paper, in a dark frame with a gold line. Its cover shows the puzzle it studied: a row whose two ends
// share a colour is filled in; one whose ends differ stays empty.
function drawFramedPaper(p) {
  p.rect(0, 0, 14, 16, '#5a3a22').box(1, 1, 12, 14, '#c89838').rect(2, 2, 10, 12, '#ffffff');
  p.hline(3, 3, 6, '#8a8478');
  p.rect(3, 5, 8, 5, '#1e1e24').hline(3, 6, 8, '#FF4136').px(3, 8, '#0074D9').px(10, 8, '#2ECC40');
  p.hline(3, 11, 8, INK).hline(3, 12, 5, INK);
}

// ---------------------------------------------------------------- the toys

// The server rack: five servers, each with two little lights that blink in a pattern of their own.
function drawRack(p, { frame }) {
  p.rect(1, 1, 14, 27, STEEL.base).hline(1, 1, 14, STEEL.light).vline(1, 2, 26, '#5a5e68').vline(14, 2, 26, STEEL.dark);
  for (let i = 0; i < 5; i++) {
    const y = 3 + i * 5;
    p.rect(3, y, 10, 4, STEEL.deep).hline(3, y, 10, '#40444e').hline(4, y + 2, 4, '#3a3d46');
    for (let k = 0; k < 2; k++) {
      const on = hash(i, k, frame) % 3 !== 0;
      p.px(10 + k * 2, y + 2, on ? ['#6ee06a', '#7fe0c0'][k] : '#2e4038');
    }
  }
  p.rect(2, 28, 3, 1, STEEL.dark).rect(11, 28, 3, 1, STEEL.dark);
  p.outline(OUTLINE);
}

// A glass tower of six stacked layers, like the layers of a language model; a glow climbs them one floor at a time.
function drawTower(p, { frame }) {
  p.rect(1, 1, 14, 3, '#5a6070').hline(1, 1, 14, '#8a909c');
  p.rect(2, 4, 12, 24, '#243044').vline(2, 4, 24, '#3a4862').vline(13, 4, 24, '#1a2232');
  for (let i = 0; i < 6; i++) {
    const y = 24 - i * 4;
    const lit = i === frame;
    p.rect(4, y, 8, 3, lit ? '#9ff0dc' : '#2f8a7c').hline(4, y, 8, lit ? '#f0fffa' : '#45b0a0');
  }
  p.vline(3, 5, 6, '#5a6a8a'); // a glint on the glass
  p.rect(1, 28, 14, 3, STEEL.base).hline(1, 28, 14, STEEL.light);
  p.outline(OUTLINE);
}

// My desk: a laptop full of code, a brass desk lamp and a mug.
function drawMyDesk(p) {
  p.rect(18, 4, 7, 3, '#3c8a5a').hline(19, 3, 5, '#3c8a5a').hline(19, 3, 4, '#6cc08a').hline(18, 7, 7, '#fff2b0'); // the lamp's shade and its glow
  p.vline(21, 8, 6, GOLD.dark).rect(19, 13, 5, 2, GOLD.base).hline(19, 13, 5, GOLD.light); // its stem and base
  p.rect(3, 4, 13, 9, '#4a4f5a').rect(4, 5, 11, 7, '#1e2a44');
  for (const [x, y, w, color] of [[5, 6, 4, '#7fe0c0'], [6, 8, 6, '#f2c43c'], [6, 10, 3, '#e86a5a'], [10, 10, 4, '#9fb0cf']]) p.hline(x, y, w, color);
  p.rect(2, 13, 15, 2, '#9aa2b4').hline(2, 13, 15, '#c4ccdc');
  p.rect(26, 10, 4, 5, '#e8e4dc').vline(30, 11, 2, '#e8e4dc').hline(26, 10, 4, '#ffffff'); // the mug
  p.rect(1, 15, 30, 3, WOOD.top).hline(1, 15, 30, WOOD.pale).hline(1, 17, 30, WOOD.base);
  p.rect(2, 18, 28, 7, WOOD.base).box(4, 19, 11, 5, WOOD.dark).box(17, 19, 11, 5, WOOD.dark);
  p.px(9, 21, GOLD.base).px(22, 21, GOLD.base); // drawer knobs
  p.rect(2, 25, 3, 2, WOOD.dark).rect(27, 25, 3, 2, WOOD.dark);
  p.outline(OUTLINE);
}

// The containers: three stacked, end on, with ribbed sides and door bars, and a little flag of Spain on top.
function drawContainers(p) {
  p.vline(12, 1, 6, '#8a8478').rect(8, 1, 4, 1, '#c8102e').rect(8, 2, 4, 2, '#f1bf00').rect(8, 4, 4, 1, '#c8102e');
  for (const [y, base, light, dark] of [[7, '#3a7ac8', '#6a9ee0', '#2c5e9e'], [14, '#e8783a', '#f6a06a', '#b85a28'], [21, '#4a9a5a', '#70c080', '#357040']]) {
    p.rect(1, y, 14, 7, base).hline(1, y, 14, light).hline(1, y + 6, 14, dark);
    for (let x = 3; x < 14; x += 2) p.vline(x, y + 1, 5, dark);
    p.vline(7, y + 1, 5, '#e8e4dc').vline(8, y + 1, 5, '#e8e4dc'); // the door bars
  }
  p.rect(1, 28, 14, 1, STEEL.dark);
  p.outline(OUTLINE);
}

// The vending machine: blue, with a glass front, two buttons (v1 plain, v2 with sprinkles; no letters, the text box
// names them) and a tray where the biscuit lands.
function vending(biscuit) {
  return { width: 16, height: 30, draw: (p) => drawVending(p, biscuit) };
}

function drawVending(p, biscuit) {
  const BODY = { light: '#7aa6e4', base: '#4f80cc', shade: '#3a62a8', dark: '#2c4c86' };
  const GLASS = { base: '#cfeaf6', light: '#f0faff', shelf: '#8fb4c8' };
  const BISCUIT = { base: '#dca060', light: '#f0c080', dark: '#a8703c' };
  const ICING = { base: '#f490b0', light: '#ffc0d4' };
  // The cabinet, lit from the left, on two little feet.
  p.rect(1, 1, 14, 26, BODY.base).vline(1, 1, 26, BODY.light).vline(14, 1, 26, BODY.shade).hline(1, 1, 14, BODY.light);
  p.rect(2, 27, 3, 2, BODY.dark).rect(11, 27, 3, 2, BODY.dark);
  // The glass front: three shelves of snacks.
  p.rect(2, 4, 8, 16, GLASS.base).vline(2, 4, 16, GLASS.light).px(3, 5, GLASS.light);
  for (const [y, colors] of [[8, ['#dca060', '#f490b0', '#dca060']], [13, ['#8a5a34', '#dca060', '#f2c43c']], [18, ['#f490b0', '#8a5a34', '#f490b0']]]) {
    p.hline(2, y + 1, 8, GLASS.shelf);
    colors.forEach((color, i) => p.rect(3 + i * 2, y - 1, 2, 2, color));
  }
  // The buttons and the coin slot.
  p.rect(11, 4, 3, 16, '#26324e');
  p.rect(11, 6, 2, 2, BISCUIT.light).rect(11, 10, 2, 2, ICING.base).px(12, 10, '#ffffff');
  p.vline(12, 15, 3, '#0f1420');
  // The tray, and the biscuit that dropped into it.
  p.rect(3, 22, 10, 4, '#1a1f2e').hline(3, 22, 10, BODY.dark);
  if (biscuit !== 'empty') {
    p.rect(5, 23, 6, 3, BISCUIT.base).hline(5, 23, 6, BISCUIT.light).px(5, 25, BISCUIT.dark).px(10, 25, BISCUIT.dark);
    if (biscuit === 'sprinkles') {
      p.rect(6, 23, 4, 2, ICING.base).hline(6, 23, 4, ICING.light);
      ['#ffffff', '#5ab0e0', '#f2c43c', '#7ac080'].forEach((color, i) => p.px(6 + i, 23 + (i % 2), color));
    } else {
      p.px(7, 24, BISCUIT.dark).px(9, 24, BISCUIT.dark);
    }
  }
  p.outline(OUTLINE);
}

// The desk where the annotators work: passages marked green (relevant) or red (not).
function drawLabellingDesk(p) {
  p.rect(3, 3, 10, 8, '#4a4f5a').rect(4, 4, 8, 6, '#f4f6fb');
  p.hline(5, 5, 4, INK).px(10, 5, '#5cd060').hline(5, 7, 4, INK).px(10, 7, '#e86a5a').hline(5, 9, 3, INK).px(10, 9, '#5cd060');
  p.rect(2, 11, 12, 2, '#9aa2b4').hline(2, 11, 12, '#c4ccdc');
  p.rect(1, 13, 14, 3, WOOD.top).hline(1, 13, 14, WOOD.pale).hline(1, 15, 14, WOOD.base);
  p.rect(2, 16, 2, 3, WOOD.base).rect(12, 16, 2, 3, WOOD.base);
  p.outline(OUTLINE);
}

// A little sign on legs by the door, painted with the Shift arrow (it says, in the text box, that Shift runs).
function drawShiftSign(p) {
  p.rect(1, 1, 12, 10, '#f4efe2').hline(1, 1, 12, '#ffffff').hline(1, 10, 12, '#d8d0bc');
  p.rows(3, 2, ARROW, { a: '#26324e' });
  p.vline(3, 11, 4, WOOD.base).vline(10, 11, 4, WOOD.base);
  p.outline(OUTLINE);
}

// The Shift key's arrow, small and hollow.
const ARROW = [
  '...aa...',
  '..a..a..',
  '.a....a.',
  'aaa..aaa',
  '..a..a..',
  '..a..a..',
  '..aaaa..',
];

// ---------------------------------------------------------------- the rug

const N = 1; // the bits of a tile's `mask`: which neighbours are not rug, as in tiles.js
const E = 2;
const S = 4;
const W = 8;

// The rug under my desk: navy with a small diamond on every tile, and a gold border 2 px inside its outer edges.
function drawRug(p, { mask }) {
  const [n, e, s, w] = [N, E, S, W].map((bit) => Boolean(mask & bit));
  p.rect(0, 0, 16, 16, RUG.base);
  p.px(7, 6, RUG.dot).px(6, 7, RUG.dot).px(8, 7, RUG.dot).px(7, 8, RUG.dot);
  // The border stops where two edges meet, so the corners come out square.
  const [x0, x1, y0, y1] = [w ? 2 : 0, e ? 13 : 15, n ? 2 : 0, s ? 13 : 15];
  if (n) p.hline(x0, 2, x1 - x0 + 1, RUG.gold).hline(0, 0, 16, RUG.rim);
  if (s) p.hline(x0, 13, x1 - x0 + 1, RUG.gold).hline(0, 15, 16, RUG.rim);
  if (w) p.vline(2, y0, y1 - y0 + 1, RUG.gold).vline(0, 0, 16, RUG.rim);
  if (e) p.vline(13, y0, y1 - y0 + 1, RUG.gold).vline(15, 0, 16, RUG.rim);
}
const RUG = { base: '#2c3a5e', dot: '#3e5080', gold: '#c89838', rim: '#1e2840' };
