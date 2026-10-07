// The Chess House: a giant ivory pawn, with a door in its round base and round windows in its body and head.
// Inside: my chess story, my favourite game on the table, and a boss battle against Stockfish at about my level.

// My favourite over-the-board game (I played Black), in PGN as exported from chess.com.
// A {comment} after a move is shown under the board when the viewer reaches that move.
const FAVOURITE_GAME = `[Event ""]
[Site "GxAlekhine"]
[Date "2019.05.09"]
[Round "3"]
[White "Bernardo Marques Vedor"]
[Black "Guilherme Costa"]
[Result "0-1"]
[WhiteElo "1613"]
[BlackElo "1617"]
[TimeControl "1h30m+30s"]
[Link "https://www.chess.com/analysis/collection/my-games-2Ucdb6GgW/4sqTJbw1Jn/analysis?move=51"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Bc5 5. c3 O-O 6. Bxc6 bxc6 7. Nxe5 Re8 8.
d4 Rxe5 {I spent 40 minutes on this move!} 9. dxe5 Nxe4 10. Qe2 Bxf2+ 11. Kf1 Qh4 12. Nd2 Nxd2+ 13. Bxd2 Bb6 14. g3
Qe7 15. Be3 a5 16. Qf3 Qxe5 17. Bxb6 cxb6 18. Re1 Ba6+ 19. Kg2 Qb5 20. Re7 Qxb2+
21. Kh3 Bc4 22. Rhe1 Rf8 23. g4 Be6 24. Re2 Qa3 25. R7xe6 fxe6 26. Qe3 Qc5 0-1`;

// The boss battle (see the end of this file).
const BOSS = [4, 2]; // in front of the knight picture, behind the table
const ELO = 2000;
// Me, dressed in black for the occasion: the player's hair and skin (player.js), with black clothes and shoes.
const BOSS_LOOK = { C: '#33303c', c: '#24212c', P: '#2c2a34', p: '#211f28', B: '#1c1a22' };
const LAST = { result: null, unfinished: false }; // the last battle, remembered for the whole visit to the site

export default {
  id: 'chess',
  name: 'Chess House',

  // Top-left tile of the footprint on the town map: [column, row].
  at: [9, 5],

  // One character per tile: "#" wall, "D" door (exactly one), "." open (you can walk behind it).
  // The pawn's body is narrower than its base, so the top row's corners are open.
  footprint: [
    '.###.',
    '#####',
    '##D##',
  ],

  // The picture is centred on the footprint and stands on its bottom edge; the pawn's body and head stick out above.
  sprite: { width: 80, height: 74, draw: drawPawnTower },
  door: { height: 22 },

  // A signpost next to the door. "at" is relative to the door: one tile left and one down.
  sign: { text: 'Chess House', at: [-1, 1] },

  // The inside: a room whose floor is a giant chessboard.
  interior: {
    size: [9, 8], // columns, rows (the top two rows are the back wall)
    floor: 'checker',
    // Shown when someone walks in. One string per page of the text box: a whole sentence of at most 68 characters.
    message: [
      'I am a big fan of chess!',
      'I started playing when I was around 14, against my dad.',
      'Then I started entering tournaments.',
      'After 1 year, I was in the top 15 for my age in Portugal!',
      "I don't play much anymore, but I'm still around 2000 on chess.com!",
    ],
    // The boss notices you as you come round the table, like a trainer in the old games.
    onStep: (ctx, x, y) => {
      if (!ctx.state.spotted && y >= BOSS[1] && y <= BOSS[1] + 1 && Math.abs(x - BOSS[0]) <= 2) ctx.run(spotted);
    },
    decor: [
      { at: [3, 0], size: [3, 2], offset: [0, -6], sprite: { width: 32, height: 24, draw: drawKnightPicture } },
      {
        // The table: walking up to it (or pressing A in front of it) tells the story, then offers the game.
        at: [3, 4],
        size: [3, 1],
        sprite: { width: 44, height: 24, draw: drawChessTable },
        text: [
          "It's not my best game, but it's my favourite from my tournaments.",
          'I spent 40 minutes on move 8, Rxe5.',
          "It's not the best computer move, but it was the most fun :)",
        ],
        game: { pgn: FAVOURITE_GAME, orientation: 'black', title: 'My favourite game', ask: 'Do you want to see the game?' },
      },
      {
        // The boss, in front of the knight picture: talk to them to play Stockfish.
        at: BOSS,
        label: 'the boss',
        npc: { facing: 'down', palette: BOSS_LOOK },
        text: () => bossLines(),
        ask: () => challenge(),
      },
      { type: 'plant', at: [0, 2] },
      { type: 'plant', at: [8, 2] },
    ],
  },
};

const OUTLINE = '#2e1a10';
const IVORY = '#f2e4c4';
const LIGHT_SQUARE = '#f0d9b5';
const DARK_SQUARE = '#b58863';
// The pawn's ivory, from light to dark: the light comes from the top left.
const PAWN = ['#ffffff', '#f6eedc', '#e4d6b6', '#c9b690', '#a8946e'];

function drawPawnTower(p, { width: W, height: H, door }) {
  const cx = W / 2;
  // From the bottom up, so each part overlaps the one below it. It is as tall as Técnico's cap (74 px).
  drawDisc(p, cx, H - 18, H - 6, 36, 5, 5); // the base
  drawDisc(p, cx, H - 24, H - 18, 30, 4, 4); // the ring
  for (let y = 30; y < H - 22; y++) {
    const half = Math.round(10 + 15 * ((y - 30) / (H - 53)) ** 1.8); // the body flares out towards the ring
    for (let x = cx - half; x < cx + half; x++) p.px(x, y, roundShade((x + 0.5 - cx) / half));
  }
  drawDisc(p, cx, 23, 28, 7, 1, 0); // the neck
  drawDisc(p, cx, 27, 30, 16, 2, 2); // the collar
  // The head: a ball.
  const r = 12.5;
  for (let y = 1; y < 27; y++) {
    for (let x = cx - 13; x < cx + 13; x++) {
      const dx = (x + 0.5 - cx) / r;
      const dy = (y + 0.5 - 13.5) / r;
      if (dx * dx + dy * dy > 1) continue;
      const light = -dx * 0.7 - dy * 0.7;
      p.px(x, y, PAWN[light > 0.8 ? 0 : light > 0.2 ? 1 : light > -0.35 ? 2 : light > -0.75 ? 3 : 4]);
    }
  }
  drawRoundWindow(p, cx, 13, 5);
  drawRoundWindow(p, cx, 40, 3);

  // The door goes exactly where the game expects it (it animates the doorway when it opens).
  const bottom = H - 1;
  p.rect(door.x - 2, door.y - 2, door.w + 4, bottom - door.y + 2, PAWN[4]);
  p.rect(door.x, door.y, door.w, bottom - door.y, '#5a3420');
  p.px(door.x - 2, door.y - 2, PAWN[2]).px(door.x + door.w + 1, door.y - 2, PAWN[3]).px(door.x, door.y, PAWN[4]).px(door.x + door.w - 1, door.y, PAWN[4]);
  p.rect(door.x + 2, door.y + 3, 5, bottom - door.y - 5, '#7a4a2a').rect(door.x + 9, door.y + 3, 5, bottom - door.y - 5, '#7a4a2a');
  p.px(door.x + 12, door.y + 12, '#f2c43c');
  p.outline(OUTLINE);
}

// Shade of a round surface: t runs from -1 (its left edge) to 1 (its right edge).
function roundShade(t) {
  return PAWN[t < -0.6 ? 0 : t < -0.1 ? 1 : t < 0.4 ? 2 : t < 0.75 ? 3 : 4];
}

// A disc seen from above at an angle: its side, whose front edge curves down towards us by `bulge` pixels,
// and (if `face` is the oval's half-height) its top face.
function drawDisc(p, cx, top, bottom, half, bulge, face) {
  for (let x = cx - half; x < cx + half; x++) {
    const t = (x + 0.5 - cx) / half;
    p.vline(x, top, bottom - top + 1 + Math.round(bulge * Math.sqrt(1 - t * t)), roundShade(t));
  }
  if (face) p.ellipse(cx, top, half - 1, face, PAWN[1]).ellipse(cx - 2, top - 1, half - 8, Math.max(1, face - 2), PAWN[0]);
}

function drawRoundWindow(p, cx, cy, r) {
  p.ellipse(cx, cy, r + 1, r + 1, PAWN[4]).ellipse(cx, cy, r, r, '#5fa8e0');
  p.hline(cx - r, cy, 2 * r + 1, PAWN[2]).vline(cx, cy - r, 2 * r + 1, PAWN[2]);
  p.px(cx - Math.ceil(r / 2), cy - Math.ceil(r / 2), '#c8ecff');
}

const KNIGHT = [
  '......k.k.....',
  '.....kkkkk....',
  '....kkkkkkk...',
  '...kkkekkkkk..',
  '..kkkkkkkkkkk.',
  '.kkkkkkkkkkkk.',
  'kkkkkkkkkkkkk.',
  'kkk...kkkkkkk.',
  '.k.....kkkkkk.',
  '......kkkkkkk.',
  '.....kkkkkkkk.',
  '....kkkkkkkkk.',
  '...kkkkkkkkkk.',
  '..kkkkkkkkkkkk',
  '.kkkkkkkkkkkkk',
  '.kkkkkkkkkkkkk',
];

function drawKnightPicture(p) {
  p.rect(0, 0, 32, 24, '#c89838').hline(0, 23, 32, '#9a7028').vline(31, 0, 24, '#9a7028');
  p.rect(2, 2, 28, 20, '#2f5d50');
  p.rows(9, 4, KNIGHT, { k: IVORY, e: '#2f5d50' });
}

function drawChessTable(p) {
  p.rect(5, 14, 3, 9, '#6e4426').rect(36, 14, 3, 9, '#6e4426'); // legs
  p.rect(2, 11, 40, 4, '#8a5a34').hline(2, 14, 40, '#6e4426'); // apron
  p.rect(1, 4, 42, 8, '#a8683c').hline(1, 4, 42, '#c08050'); // table top
  p.checker(6, 5, 8, 2, 4, 3, LIGHT_SQUARE, DARK_SQUARE);
  p.rect(11, 1, 3, 5, IVORY).rect(30, 1, 3, 5, '#3a3446'); // a white and a black piece
  p.outline(OUTLINE);
}

// ---------------------------------------------------------------- the boss battle

function bossLines() {
  if (LAST.unfinished) return ['Back for more? Our game is still on the board.'];
  const again = {
    won: 'You beat Stockfish! Do you want to try again?',
    lost: 'Ready for a rematch with Stockfish?',
    draw: 'A draw last time! Ready to go for the win?',
    resigned: 'Ready to give Stockfish another go?',
  }[LAST.result];
  if (again) return [again];
  return [
    "Hey! I'm the boss of the Chess House.",
    "I haven't been able to build an AI that plays like me just yet.",
    'But you can play my good friend Stockfish, at about my level: 2000!',
  ];
}

function challenge() {
  const notNow = ["No problem. I'll be right here!"];
  const pieces = {
    question: 'Which pieces do you want?',
    choices: ['White', 'Black', 'Not now'],
    answers: [(c) => c.run(battle('w')), (c) => c.run(battle('b')), notNow],
  };
  if (LAST.unfinished) {
    return { question: 'Do you want to carry on with it?', choices: ['Carry on', 'New game', 'Not now'], answers: [(c) => c.run(battle(null)), pieces, notNow] };
  }
  return { question: 'Do you want to play Stockfish?', answers: [pieces, notNow] };
}

// Spotted: a "!" over the boss, you walk up to them, and they challenge you.
function* spotted(ctx) {
  ctx.state.spotted = true;
  ctx.preload('battle'); // the board and Stockfish download while the visitor reads
  ctx.announce('The boss of the Chess House has spotted you!');
  const { x: fromX } = ctx.player;
  ctx.face(fromX < BOSS[0] ? 'right' : fromX > BOSS[0] ? 'left' : 'up');
  ctx.overlay((g, view) => drawBang(g, view));
  yield* ctx.wait(40);
  ctx.overlay(null);
  // Into the square in front of the boss.
  let { x, y } = ctx.player;
  if (y === BOSS[1]) {
    yield* ctx.walk('down');
    y++;
  }
  while (x !== BOSS[0]) {
    const dir = x < BOSS[0] ? 'right' : 'left';
    yield* ctx.walk(dir);
    x += dir === 'right' ? 1 : -1;
  }
  ctx.face('up');
  ctx.ask({ text: bossLines(), ...challenge() });
}

// The battle starts like in the old games: the screen flashes twice, then black stripes sweep across it from both
// sides, and the board opens. Visitors who prefer reduced motion get a plain fade to black instead.
// `color` is 'w' or 'b' for a new game, or null to carry on with the unfinished one.
function battle(color) {
  return function* (ctx) {
    ctx.preload('battle');
    ctx.announce('A chess battle against Stockfish begins!');
    const calm = ctx.reducedMotion;
    let t = 0;
    ctx.overlay((g, view) => drawIntro(g, view, calm ? -1 : t));
    for (; t < (calm ? 1 : 64); t++) yield;
    ctx.overlay((g, view) => drawIntro(g, view, -1));
    ctx.show('battle', {
      elo: ELO,
      color: color ?? 'w',
      resume: color === null,
      title: `Stockfish, about ${ELO}`,
      onClose: (c, result) => c.run(afterBattle(result)),
    });
  };
}

// Back from the board: the room comes out of the black, and the boss says how it went.
function afterBattle(result) {
  return function* (ctx) {
    LAST.unfinished = result === 'unfinished';
    if (result !== 'unfinished' && result !== 'unstarted') LAST.result = result;
    const steps = ctx.reducedMotion ? 1 : 20;
    for (let i = 1; i <= steps; i++) {
      const alpha = 1 - i / steps;
      ctx.overlay((g, view) => {
        g.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        g.fillRect(0, 0, view.width, view.height);
      });
      yield;
    }
    ctx.overlay(null);
    const words = {
      won: ['Checkmate! You beat Stockfish at my level.', 'That means you would probably beat me too. Well played!'],
      lost: ['Stockfish wins this time. It is tough at 2000!', 'Talk to me any time for a rematch.'],
      draw: ['A draw against Stockfish at 2000! That is a good result.'],
      resigned: ['No shame in resigning: Stockfish at 2000 is tough!', 'Talk to me any time for a rematch.'],
      unfinished: ['Taking a break? I will keep our game on the board.', 'Talk to me again to carry on.'],
      unstarted: ['Changed your mind? Talk to me whenever you are ready.'],
    };
    ctx.say(words[result] ?? words.unstarted);
  };
}

// A "!" in a speech bubble over the boss's head.
function drawBang(g, view) {
  const x = BOSS[0] * 16 + 2 - view.camX;
  const y = BOSS[1] * 16 - 15 - view.camY;
  g.fillStyle = OUTLINE;
  g.fillRect(x + 1, y, 10, 13);
  g.fillRect(x, y + 1, 12, 11);
  g.fillRect(x + 4, y + 13, 3, 2); // the tail
  g.fillStyle = '#ffffff';
  g.fillRect(x + 1, y + 1, 10, 11);
  g.fillRect(x + 5, y + 12, 1, 1);
  g.fillStyle = '#d83a2a';
  g.fillRect(x + 5, y + 3, 2, 5);
  g.fillRect(x + 5, y + 9, 2, 2);
}

// The battle intro at tick t (0 to 63): two white flashes, then 8-pixel stripes sliding in, odd ones from the left
// and even ones from the right, until the screen is black. t = -1 is plain black.
function drawIntro(g, view, t) {
  const { width, height } = view;
  if (t < 0) {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, width, height);
    return;
  }
  if (t < 20) {
    if (t % 10 < 4) {
      g.fillStyle = 'rgba(255, 255, 255, 0.85)';
      g.fillRect(0, 0, width, height);
    }
    return;
  }
  const progress = (t - 20) / 40;
  g.fillStyle = '#000000';
  for (let row = 0; row * 8 < height; row++) {
    const w = Math.ceil(width * Math.min(1, progress * (1 + (row % 3) * 0.25)));
    g.fillRect(row % 2 ? 0 : width - w, row * 8, w, 8);
  }
}
