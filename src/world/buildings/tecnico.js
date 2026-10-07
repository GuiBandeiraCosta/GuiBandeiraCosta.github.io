import player from '../player.js';

// Técnico: a giant graduation cap. Its round crown is the walls and its board is the roof.
// The ground floor is a lecture hall (my years at Instituto Superior Técnico, Lisbon); the stairs in the corner
// lead up to a Korean room (my exchange semester at Sungkyunkwan University, SKKU).

// A classmate with long hair (the others reuse the player's pictures with other colours).
const LONG_HAIR = [
  '................',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHHK...',
  '..KHHHHHHHHHHK..',
  '..KHHHHHHHHHHK..',
  '..KHHSHHHHSHHK..',
  '..KHSSSSSSSSHK..',
  '..KHSEsSSsESHK..',
  '..KHsSSSSSSsHK..',
  '..KHHKCCCCKHHK..',
  '..KKSKCCCCKSKK..',
  '...KsKcCCcKsK...',
  '....KPPPPPPK....',
  '....KPpKKpPK....',
  '....KBBK.KBBK...',
];

export default {
  id: 'tecnico',
  name: 'Técnico',

  // Top-left tile of the footprint on the town map: [column, row].
  at: [2, 5],

  // One character per tile: "#" wall, "D" door (exactly one), "." open (you can walk behind it).
  footprint: [
    '#####',
    '#####',
    '##D##',
  ],

  // The picture is centred on the footprint and stands on its bottom edge. The board (the roof) is wider than
  // the walls: it overhangs a tile on each side, and the player walks under its corners.
  sprite: { width: 112, height: 74, draw: drawCapHouse },
  door: { height: 26 },

  sign: { text: 'Técnico (Instituto Superior Técnico, Lisbon)' },

  // The ground floor: a lecture hall.
  interior: {
    size: [11, 9], // columns, rows (the top two rows are the back wall)
    floor: 'wood',
    message: [
      'Welcome to Técnico: Instituto Superior Técnico, in Lisbon!',
      'I studied Computer Science and Engineering here for five years.',
      "First a bachelor's, from 2019 to 2022, then a master's until 2024.",
      'Upstairs: my exchange semester in South Korea!',
    ],
    decor: [
      {
        at: [1, 0],
        size: [1, 2],
        offset: [0, -6],
        sprite: { width: 14, height: 16, draw: drawDiploma },
        text: ["My master's diploma.", 'I finished with an average of 18/20, and my thesis got 19/20!', 'In Portugal, university grades go from 0 to 20.'],
      },
      {
        at: [3, 0],
        size: [5, 2],
        offset: [0, -6],
        sprite: { width: 76, height: 24, draw: drawBlackboard },
        text: ['A search tree, with the path it found in yellow.', 'Next to it, a route planned around walls.', 'That is Search and Planning in a nutshell!'],
      },
      {
        at: [9, 0],
        size: [1, 2],
        offset: [0, -6],
        sprite: { width: 14, height: 16, draw: drawMedal },
        text: ['Técnico recognized me as an excellence student, for my results!'],
      },
      { type: 'plant', at: [0, 2] },
      {
        // The teacher's desk: walking up the aisle to it tells the teaching assistant story.
        at: [4, 3],
        size: [3, 1],
        sprite: { width: 46, height: 26, draw: drawTeacherDesk },
        text: [
          'From 2023 to 2024, I was invited to be a teaching assistant.',
          'I taught Artificial Intelligence and Search and Planning.',
          'I taught more than 80 students and graded over 30 of their projects!',
        ],
      },
      ...[1, 3, 6, 8].flatMap((x) => [5, 7].map((y) => ({ at: [x, y], size: [2, 1], sprite: { width: 32, height: 22, draw: drawStudentDesk } }))),
    ],

    // The second floor: a Korean room. The stairs are in the top-right corner of both floors.
    upstairs: {
      size: [11, 8],
      floor: 'ondol',
      message: [
        "During my master's, I spent a semester in South Korea!",
        'I studied at Sungkyunkwan University (SKKU), in Suwon and Seoul.',
        'I met lots of new people, and travelled around Asia!',
      ],
      decor: [
        { at: [0, 0], size: [11, 2], sprite: { width: 176, height: 32, draw: drawHanokWall } },
        postcard(4, 'japan', 'A postcard from Japan, with Mount Fuji on it.'),
        postcard(5, 'vietnam', 'A postcard from Vietnam: a boat among the islands of Ha Long Bay.'),
        postcard(6, 'cambodia', 'A postcard from Cambodia: Angkor Wat at sunset.'),
        postcard(7, 'thailand', 'A postcard from Thailand, with a golden temple on it.'),
        {
          at: [0, 2],
          sprite: { width: 16, height: 30, draw: drawGinkgo },
          text: ['A ginkgo tree, the symbol of SKKU.', 'The old ginkgos on its Seoul campus are about 500 years old!'],
        },
        {
          at: [4, 4],
          size: [3, 1],
          sprite: { width: 44, height: 20, draw: drawDinnerTable },
          text: ['A Korean dinner: rice, a pot of stew and lots of little side dishes.', 'Always better shared with friends!'],
        },
        { at: [3, 4], solid: false, offset: [0, -3], sprite: cushion('#c84848', '#e46a6a', '#9a3030') },
        { at: [7, 4], solid: false, offset: [0, -3], sprite: cushion('#4868b8', '#6a8ad8', '#34508e') },
        classmate([2, 5], { H: '#3e3648', C: '#e05050', c: '#b03838', P: '#4a6aa4', p: '#3a5486' }, player.frames.down, [
          "Annyeong! That's how you say hi in Korean.",
        ]),
        classmate([5, 3], { H: '#5a3a28', S: '#d8a07a', s: '#b87e5a', C: '#f2b838', c: '#c88e20', P: '#5a5a6a', p: '#46465a' }, player.frames.up, [
          'So many places to visit, and only one semester!',
        ]),
        classmate([8, 6], { H: '#e0b860', C: '#5a84e0', c: '#3e64b8', P: '#4a4a56', p: '#3a3a44' }, LONG_HAIR, [
          'We came from all over the world to study here!',
        ]),
      ],
    },
  },
};

// Classmates stand a few pixels up their tile, like the player.
function classmate(at, colors, rows, text) {
  return { at, offset: [0, -3], sprite: { pixels: rows, palette: { ...player.palette, ...colors } }, text };
}

// A postcard pinned high on the back wall, read from the tile in front of it.
function postcard(column, scene, text) {
  return { at: [column, 0], size: [1, 2], offset: [0, -12], sprite: { width: 14, height: 13, draw: (p) => drawPostcard(p, scene) }, text };
}

function cushion(base, light, dark) {
  return {
    width: 14,
    height: 9,
    draw: (p) => p.rect(1, 1, 12, 7, base).hline(1, 1, 12, light).hline(1, 7, 12, dark).rect(6, 4, 2, 1, GOLD.base).outline(OUTLINE),
  };
}

const OUTLINE = '#2a2430';
const IST = { light: '#5cc6f2', blue: '#009de0', dark: '#0079b8', deep: '#07598a' }; // Técnico's blue
const CAP = {
  top: '#2d3549', hi: '#56627f', rim: '#3d4862', edge: '#151a26', line: '#0c0f17', // the board
  sideHi: '#3c4762', side: '#2b3347', sideDark: '#1e2434', // the crown's walls, lit from the left
  plinthHi: '#55607c', plinth: '#46506a', plinthDark: '#363e54',
};
const GOLD = { light: '#fde68e', base: '#f2c43c', dark: '#c08a1e' };
const WOOD = { deep: '#4a2c18', dark: '#5a3420', base: '#7a4a2a', light: '#a06a40', top: '#c08050', pale: '#d8a066' };
const GLASS = { base: '#5fa8e0', light: '#c8ecff' };
const PAPER = '#f6efd8';
const CHALK = { board: '#2f5a46', smudge: '#3b6853', white: '#e8f0e6', dim: '#9fbcaa', yellow: '#f8e070', pink: '#f6a8b0', green: '#a8e8a8' };

// ---------------------------------------------------------------- outside

function drawCapHouse(p, { width: W, height: H, door }) {
  const cx = W / 2;
  const r = 36; // half the width of the walls
  const bottom = H - 1;
  // The walls: the cap's crown, a short wide drum whose front curves down towards us, on a stone plinth.
  for (let x = cx - r; x < cx + r; x++) {
    const t = (x + 0.5 - cx) / r;
    const foot = H - 6 + Math.round(5 * Math.sqrt(1 - t * t)); // the wall's bottom row: H - 1 in the middle
    p.vline(x, 20, foot - 19, t < -0.55 ? CAP.sideHi : t < 0.45 ? CAP.side : CAP.sideDark);
    p.vline(x, foot - 2, 3, t < -0.55 ? CAP.plinthHi : t < 0.45 ? CAP.plinth : CAP.plinthDark);
  }
  // Two arched windows, and the door exactly where the game expects it (it animates the doorway when it opens).
  for (const wx of [cx - 26, cx + 18]) {
    p.rect(wx - 1, 45, 10, 14, GOLD.dark).rect(wx, 46, 8, 12, GLASS.base).vline(wx + 4, 46, 12, GOLD.dark).hline(wx, 51, 8, GOLD.dark);
    p.px(wx, 46, GOLD.dark).px(wx + 7, 46, GOLD.dark).px(wx + 1, 47, GLASS.light).px(wx + 2, 48, GLASS.light);
  }
  p.rect(door.x - 2, door.y - 2, door.w + 4, bottom - door.y + 2, GOLD.base).vline(door.x + door.w + 1, door.y - 2, bottom - door.y + 2, GOLD.dark);
  p.rect(door.x, door.y, door.w, bottom - door.y, WOOD.dark);
  p.rect(door.x + 2, door.y + 2, 5, bottom - door.y - 4, WOOD.base).rect(door.x + 9, door.y + 2, 5, bottom - door.y - 4, WOOD.base);
  p.px(door.x + 7, door.y + 13, GOLD.light).px(door.x + 8, door.y + 13, GOLD.light);
  // The board's shadow on the walls, just under its front edges.
  for (let x = cx - r; x < cx + r; x++) p.vline(x, Math.round(41 - Math.abs(x + 0.5 - cx) / 3), 4, 'rgba(5, 8, 20, 0.35)');

  // The roof: the board, a flat square seen corner-on and squashed like the other roofs
  // (3 pixels across for each pixel down), with its thickness showing under the front edges.
  const board = Array.from({ length: 37 }, (_, row) => Math.max(1, 54 - 3 * Math.abs(row - 18)));
  p.profile(cx, 4, board, () => CAP.edge);
  p.profile(cx, 1, board, (t, row) => {
    const half = board[row];
    if (row <= 18 && (t + 1) * half < 3) return CAP.hi; // the back-left edge catches the light
    if (row <= 18 && (1 - t) * half < 2) return CAP.rim;
    return CAP.top;
  });
  // The button, and the cord running to the right corner, where the tassel hangs down beside the house.
  p.rect(cx - 2, 18, 4, 3, GOLD.base).hline(cx - 2, 18, 4, GOLD.light);
  for (let x = cx + 2; x <= cx + 48; x++) p.px(x, 19 + Math.floor((x - cx) / 25), GOLD.base);
  p.vline(cx + 49, 21, 32, GOLD.base).vline(cx + 50, 21, 32, GOLD.dark);
  p.rect(cx + 47, 52, 6, 12, GOLD.base).vline(cx + 51, 52, 12, GOLD.dark).vline(cx + 52, 52, 12, GOLD.dark).hline(cx + 47, 52, 6, GOLD.light);
  for (const dx of [47, 49, 51]) p.px(cx + dx, 64, GOLD.dark); // the fringe
  p.outline(CAP.line);
}

// ---------------------------------------------------------------- the lecture hall

function drawBlackboard(p) {
  const W = 76;
  p.rect(0, 0, W, 21, WOOD.base).hline(0, 0, W, WOOD.light).vline(W - 1, 0, 21, WOOD.dark).hline(0, 20, W, WOOD.dark);
  p.rect(2, 2, W - 4, 17, CHALK.board);
  p.hline(5, 17, 9, CHALK.smudge).hline(W - 20, 3, 11, CHALK.smudge).hline(W / 2 - 3, 14, 6, CHALK.smudge);
  // A search tree: the yellow branch is the path the search found.
  const root = [20, 4];
  const kids = [[12, 10], [28, 10]];
  const leaves = [[8, 16], [16, 16], [24, 16], [32, 16]];
  const edges = [[root, kids[0]], [root, kids[1]], [kids[0], leaves[0]], [kids[0], leaves[1]], [kids[1], leaves[2]], [kids[1], leaves[3]]];
  edges.forEach(([a, b], i) => line(p, a[0], a[1], b[0], b[1], i === 1 || i === 4 ? CHALK.yellow : CHALK.dim));
  for (const [x, y] of [root, ...kids, ...leaves]) p.box(x - 1, y - 1, 3, 3, CHALK.white).px(x, y, CHALK.board);
  p.rect(23, 15, 3, 3, CHALK.yellow);
  // A grid with walls, and a route planned around them from the start (green) to the goal (the yellow x).
  const gx = W - 33;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) p.px(gx + i * 4, 4 + j * 4, CHALK.dim);
  for (const [i, j] of [[2, 1], [2, 2], [4, 0], [4, 1], [5, 3]]) p.rect(gx + i * 4 - 1, 4 + j * 4 - 1, 3, 3, CHALK.white);
  const route = [[0, 3], [1, 3], [1, 0], [3, 0], [3, 2], [6, 2], [6, 0]];
  for (let k = 1; k < route.length; k++) {
    const [a, b] = [route[k - 1], route[k]];
    line(p, gx + a[0] * 4, 4 + a[1] * 4, gx + b[0] * 4, 4 + b[1] * 4, CHALK.pink);
  }
  p.rect(gx - 1, 15, 3, 3, CHALK.green);
  p.px(gx + 23, 3, CHALK.yellow).px(gx + 25, 3, CHALK.yellow).px(gx + 24, 4, CHALK.yellow).px(gx + 23, 5, CHALK.yellow).px(gx + 25, 5, CHALK.yellow);
  // The chalk tray, with chalk and an eraser.
  p.rect(1, 21, W - 2, 2, WOOD.light).hline(1, 23, W - 2, WOOD.dark);
  p.hline(8, 20, 3, CHALK.white).hline(13, 20, 2, CHALK.pink);
  p.rect(W - 14, 19, 6, 2, '#d8c8a8').hline(W - 14, 19, 6, '#5a5a6a');
}

function drawTeacherDesk(p) {
  // Graded projects (with a red tick), the laptop (its screen faces the teacher) and a mug, on the desk.
  p.rect(4, 6, 11, 5, '#e2e2da').rect(5, 5, 11, 5, '#fafaf4').hline(7, 6, 6, '#b8b8c8').hline(7, 8, 4, '#b8b8c8');
  p.px(12, 7, '#d83c3c').px(13, 8, '#d83c3c').px(14, 7, '#d83c3c');
  p.rect(21, 1, 14, 9, '#9aa2b4').hline(21, 1, 14, '#c4ccdc').vline(34, 1, 9, '#7a8294').px(27, 5, '#c4ccdc');
  p.rect(38, 5, 4, 5, '#d85848').hline(38, 5, 4, '#f08070').vline(42, 6, 2, '#d85848');
  // The desk: a top and a solid front panel.
  p.rect(1, 10, 44, 4, WOOD.top).hline(1, 10, 44, WOOD.pale).hline(1, 13, 44, WOOD.base);
  p.rect(2, 14, 42, 10, WOOD.base).box(5, 16, 36, 6, WOOD.dark).hline(6, 17, 34, WOOD.light);
  p.outline(OUTLINE);
}

function drawStudentDesk(p) {
  p.rect(5, 2, 7, 3, '#fafaf4').hline(6, 3, 4, '#b8b8c8'); // a notebook
  p.hline(20, 4, 5, GOLD.base).px(25, 4, '#3a3a40'); // a pencil
  p.rect(1, 5, 30, 4, WOOD.top).hline(1, 5, 30, WOOD.pale).hline(1, 8, 30, WOOD.base);
  p.rect(2, 9, 28, 2, WOOD.base);
  p.rect(3, 11, 2, 6, '#7a8090').rect(27, 11, 2, 6, '#7a8090');
  // Two chairs on our side, their backs towards us: the students face the blackboard.
  for (const x of [5, 18]) {
    p.rect(x, 12, 9, 6, IST.dark).hline(x, 12, 9, IST.light).hline(x, 17, 9, IST.deep);
    p.vline(x + 1, 18, 3, '#6a7080').vline(x + 7, 18, 3, '#6a7080');
  }
  p.outline(OUTLINE);
}

function drawFrame(p, inside) {
  p.rect(0, 0, 14, 16, '#5a3a22').box(1, 1, 12, 14, '#c89838').rect(2, 2, 10, 12, inside);
}

function drawDiploma(p) {
  drawFrame(p, PAPER);
  p.hline(4, 4, 6, '#8a7a5a').hline(3, 6, 8, '#c8bc9c').hline(3, 8, 8, '#c8bc9c').hline(3, 10, 5, '#c8bc9c');
  p.rect(8, 10, 3, 3, '#c83838').px(8, 10, '#e86060').px(8, 13, '#c83838').px(10, 13, '#c83838'); // the seal
}

function drawMedal(p) {
  drawFrame(p, IST.deep);
  line(p, 5, 2, 6, 7, IST.light);
  line(p, 9, 2, 8, 7, '#f4f4f4');
  p.ellipse(7, 10, 2, 2, GOLD.base).px(6, 9, GOLD.light).px(8, 11, GOLD.dark);
}

// ---------------------------------------------------------------- the Korean room upstairs

// The back wall in the style of a hanok, a traditional Korean house: plaster between wooden posts under a beam,
// and two windows of hanji paper on a wooden lattice. The stairs are drawn over its right end.
function drawHanokWall(p) {
  const W = 176;
  p.rect(0, 0, W, 32, '#f1e8d2');
  p.rect(0, 0, W, 4, WOOD.dark).hline(0, 3, W, WOOD.light).hline(0, 4, W, '#d8ccb0');
  p.rect(0, 25, W, 7, WOOD.base).hline(0, 25, W, WOOD.light).hline(0, 31, W, WOOD.deep);
  for (const x of [19, 131]) {
    p.rect(x - 1, 7, 28, 16, WOOD.dark).rect(x, 8, 26, 14, '#fbf3df');
    for (let i = 3; i < 26; i += 4) p.vline(x + i, 8, 14, '#b08050');
    p.hline(x, 12, 26, '#b08050').hline(x, 17, 26, '#b08050');
  }
  for (const x of [0, 48, 128]) p.rect(x - 1, 4, 3, 21, WOOD.base).vline(x - 1, 4, 21, WOOD.light);
}

// Little pixel versions of the trip, 12 x 10 pixels each.
const POSTCARDS = {
  japan: {
    palette: { s: '#9cd4f4', S: '#e84848', w: '#ffffff', M: '#7c8cc4', m: '#58689e', g: '#5aa858', d: '#3c8c48' },
    rows: [
      'ssssssssssss',
      'sSSsssssssss',
      'sSSssswwssss',
      'ssssswwwwsss',
      'ssssMwmwmmss',
      'sssMMmmmmmms',
      'ssMMmmmmmmmm',
      'sMMmmmmmmmmm',
      'gggggggggggg',
      'dddddddddddd',
    ],
  },
  vietnam: {
    palette: { s: '#c8e8ee', K: '#5a8a5c', k: '#3c6a48', w: '#3a9aa8', W: '#7ccad0', r: '#d84a30', b: '#6a4426' },
    rows: [
      'ssssssssssss',
      'sKksssssssss',
      'sKksssssKkss',
      'KKkksssKKkks',
      'KkkksrsKkkks',
      'KkkksrrKkkkk',
      'KkkkbbbbKkkk',
      'wwwwwwwwwwww',
      'wWwwwwWwwwww',
      'wwwwWwwwwwWw',
    ],
  },
  cambodia: {
    palette: { a: '#f49a58', b: '#f8b870', c: '#fad49a', u: '#fff2c0', t: '#4a2c48', w: '#7a6aa0', r: '#5a4a80' },
    rows: [
      'aaaaaaaaaaaa',
      'aaaaatbaaaaa',
      'bbbbbttbbbbb',
      'bbtbbttbbtbb',
      'cbttcttcttcc',
      'cbttttttttuc',
      'cttttttttttc',
      'tttttttttttt',
      'wwrwrrrrwrww',
      'wwwwwrrwwwww',
    ],
  },
  thailand: {
    palette: { s: '#a8d8f4', g: '#f2c43c', G: '#c08a1e', w: '#f6f2e8', W: '#d8d0c0', p: '#2e8a4a', t: '#8a5a34', l: '#7ac070' },
    rows: [
      'sssssgssssss',
      'sssssgsssspp',
      'sssssgssspppp',
      'ssssggGsssts',
      'sssgggGGssts',
      'ssgggggGGsts',
      'ssgggggGGsts',
      'swwwwwwwWWts',
      'wwwwwwwwwWWw',
      'llllllllllll',
    ],
  },
};

function drawPostcard(p, scene) {
  const { palette, rows } = POSTCARDS[scene];
  p.rect(0, 1, 14, 12, '#ffffff').hline(0, 12, 14, '#d8d0c0');
  p.rows(1, 2, rows.map((row) => row.slice(0, 12)), palette);
  p.px(7, 0, '#d83c3c').px(7, 1, '#a02828'); // the pin
}

// A golden ginkgo (SKKU's tree, as it looks in autumn) in a celadon pot, with a few fallen leaves.
function drawGinkgo(p) {
  for (const [x, y] of [[1, 28], [2, 29], [13, 27], [14, 29]]) p.px(x, y, GOLD.base);
  p.rect(4, 21, 8, 2, '#5f9a84').hline(4, 21, 8, '#9ccfb8');
  p.rect(5, 23, 6, 5, '#8cc0a8').vline(5, 23, 5, '#b4dcc8').vline(10, 23, 5, '#6a9e88').rect(6, 28, 4, 1, '#5f9a84');
  p.rect(7, 13, 2, 8, '#7a4a2a').vline(7, 13, 8, '#9a6438');
  p.ellipse(8, 9, 6, 6, '#d0901a').ellipse(7, 8, 5, 5, GOLD.base).ellipse(5, 6, 2, 2, GOLD.light).ellipse(10, 11, 2, 1, '#e0a828');
  p.px(3, 12, GOLD.base).px(12, 4, GOLD.base).px(13, 9, '#d0901a');
  p.outline(OUTLINE);
}

// A low table set for dinner: two bowls of rice, side dishes (kimchi and greens) and a pot of stew.
function drawDinnerTable(p) {
  for (const x of [4, 34]) p.rect(x, 5, 6, 1, '#ffffff').rect(x, 6, 6, 2, '#e4e4ec').rect(x + 1, 8, 4, 1, '#c8c8d4');
  for (const [x, food] of [[12, '#d84030'], [28, '#5aa040']]) p.rect(x, 8, 4, 1, '#f0f0f4').rect(x + 1, 7, 2, 1, food);
  p.rect(18, 4, 8, 5, '#3a3036').hline(18, 4, 8, '#d04a30').hline(19, 3, 6, '#e86a40').px(17, 5, '#3a3036').px(26, 5, '#3a3036');
  p.rect(1, 9, 42, 3, '#a85a32').hline(1, 9, 42, '#c8784a').hline(1, 11, 42, '#7a3e24');
  p.rect(3, 12, 38, 2, '#7a3e24');
  p.rect(4, 14, 3, 4, '#6a3420').rect(37, 14, 3, 4, '#6a3420');
  p.outline(OUTLINE);
}

// ---------------------------------------------------------------- helpers

// A straight 1-pixel line (Bresenham's algorithm), for the chalk drawings and the medal's ribbon.
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
