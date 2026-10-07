// Checks the chess rules and the PGN reader in src/engine/chess.js (used by the Chess House game viewer).
// The chess.js npm package is the referee: an independent, well-tested library that the site itself never loads.
//
//   cd tests
//   npm install              (once)
//   node chess.test.mjs
//
// Prints a short summary and exits with code 1 if anything is wrong.

import { Chess } from 'chess.js';
import {
  START_FEN,
  squareName,
  squareIndex,
  parseFen,
  toFen,
  legalMoves,
  makeMove,
  inCheck,
  toSan,
  sanToMove,
  perft,
  parsePgn,
} from '../src/engine/chess.js';

// ---------- tiny test helpers ----------

let passed = 0;
const failures = [];

function check(ok, what) {
  if (ok) passed++;
  else failures.push(what);
  return ok;
}

function same(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  return check(a === b, `${what}: got ${a}, expected ${b}`);
}

function throws(run, pattern, what) {
  try {
    run();
  } catch (error) {
    return check(pattern.test(error.message), `${what}: wrong error "${error.message}"`);
  }
  return check(false, `${what}: no error was thrown`);
}

function section(name, run) {
  const before = { passed, failed: failures.length };
  const started = performance.now();
  let details = '';
  try {
    details = run() ?? '';
  } catch (error) {
    failures.push(`${name} crashed: ${error.stack}`);
  }
  const failed = failures.length - before.failed;
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`${failed ? 'FAIL' : 'ok  '} ${name.padEnd(13)} ${passed - before.passed} checks passed${failed ? `, ${failed} FAILED` : ''} (${seconds} s)`);
  if (details) console.log(details.replace(/^/gm, '       '));
}

// Our parse of a game must match chess.js's record of it (`history`, its verbose moves): every move (SAN,
// squares, piece, flags, move number) and the FEN of every position. Stops at the first difference.
function compareGame(ours, startFen, history, what) {
  if (!same(ours.moves.length, history.length, `${what}: number of moves`)) return;
  same(toFen(ours.positions[0]), startFen, `${what}: start position`);
  for (const [i, move] of history.entries()) {
    const mine = (type) => (move.color === 'w' ? type.toUpperCase() : type);
    const theirs = (type) => (move.color === 'w' ? type : type.toUpperCase());
    const expected = {
      san: move.san,
      from: move.from,
      to: move.to,
      piece: mine(move.piece),
      captured: move.captured ? theirs(move.captured) : '',
      promotion: move.promotion ? mine(move.promotion) : '',
      castle: move.isKingsideCastle() ? 'K' : move.isQueensideCastle() ? 'Q' : '',
      enPassant: move.isEnPassant(),
      color: move.color,
      number: Number(move.before.split(' ')[5]),
    };
    const m = ours.moves[i];
    const actual = Object.fromEntries(Object.keys(expected).map((key) => [key, m[key]]));
    Object.assign(actual, { from: squareName(m.from), to: squareName(m.to) });
    if (!same(actual, expected, `${what}: move ${i + 1}`)) return;
    if (!same(toFen(ours.positions[i + 1]), move.after, `${what}: FEN after move ${i + 1} (${move.san})`)) return;
  }
}

// Reads `pgn` with both parsers and compares the games.
function agreesWithChessJs(pgn, what) {
  const ref = new Chess();
  ref.loadPgn(pgn);
  const history = ref.history({ verbose: true });
  const ours = parsePgn(pgn);
  compareGame(ours, history.length ? history[0].before : ref.fen(), history, what);
  return ours;
}

// chess.js adds default tags and orders them its own way, so headers are compared as sorted lists.
const sortedTags = (headers) => Object.entries(headers).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

// Our legal moves must be the same as chess.js's, compared as SAN (which also checks disambiguation, + and #).
function sameMovesAsChessJs(fen, what) {
  const state = parseFen(fen);
  const ours = legalMoves(state).map((move) => toSan(state, move)).sort();
  return same(ours, new Chess(fen).moves().sort(), `${what}: legal moves in ${fen}`);
}

// ---------- positions ----------

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const POSITION_3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
const POSITION_4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
const POSITION_4_MIRRORED = 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1';
const POSITION_5 = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';
const POSITION_6 = 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10';

// ---------- 1. perft ----------

// Node counts from https://www.chessprogramming.org/Perft_Results (checked against the page on 2026-10-06).
const PERFT = [
  ['start', START_FEN, [20, 400, 8902, 197281]],
  ['Kiwipete', KIWIPETE, [48, 2039, 97862]],
  ['position 3', POSITION_3, [14, 191, 2812, 43238]],
  ['position 4', POSITION_4, [6, 264, 9467]],
  ['position 4 mirrored', POSITION_4_MIRRORED, [6, 264, 9467]],
  ['position 5', POSITION_5, [44, 1486, 62379]],
  ['position 6', POSITION_6, [46, 2079, 89890]],
];

section('perft', () => {
  const lines = [];
  for (const [name, fen, counts] of PERFT) {
    const results = counts.map((_, i) => perft(parseFen(fen), i + 1));
    results.forEach((nodes, i) => same(nodes, counts[i], `perft ${name} depth ${i + 1}`));
    lines.push(`${name}: ${results.join(', ')}`);
  }
  return lines.join('\n');
});

// ---------- 2. the owner's game ----------

const OWNER_PGN = `[Event ""]
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
d4 Rxe5 9. dxe5 Nxe4 10. Qe2 Bxf2+ 11. Kf1 Qh4 12. Nd2 Nxd2+ 13. Bxd2 Bb6 14. g3
Qe7 15. Be3 a5 16. Qf3 Qxe5 17. Bxb6 cxb6 18. Re1 Ba6+ 19. Kg2 Qb5 20. Re7 Qxb2+
21. Kh3 Bc4 22. Rhe1 Rf8 23. g4 Be6 24. Re2 Qa3 25. R7xe6 fxe6 26. Qe3 Qc5 0-1`;

section("owner's game", () => {
  const game = agreesWithChessJs(OWNER_PGN, "owner's game");
  const ref = new Chess();
  ref.loadPgn(OWNER_PGN);
  same(game.headers, {
    Event: '',
    Site: 'GxAlekhine',
    Date: '2019.05.09',
    Round: '3',
    White: 'Bernardo Marques Vedor',
    Black: 'Guilherme Costa',
    Result: '0-1',
    WhiteElo: '1613',
    BlackElo: '1617',
    TimeControl: '1h30m+30s',
    Link: 'https://www.chess.com/analysis/collection/my-games-2Ucdb6GgW/4sqTJbw1Jn/analysis?move=51',
  }, "owner's game: headers");
  same(sortedTags(game.headers), sortedTags(ref.getHeaders()), "owner's game: headers match chess.js");
  same(game.moves.length, 52, "owner's game: 52 moves");
  same(game.positions.length, 53, "owner's game: 53 positions");
  same(game.result, '0-1', "owner's game: result");
  same([game.startComment, ...game.moves.map((m) => m.comment)].join(''), '', "owner's game: no comments");
  // The move the owner talks about: 8... Rxe5, the rook from e8 taking the knight on e5.
  const { san, number, color, from, to, captured } = game.moves[15];
  same({ san, number, color, from, to, captured }, { san: 'Rxe5', number: 8, color: 'b', from: 60, to: 36, captured: 'N' }, "owner's game: 8... Rxe5");
  same(toFen(game.positions[52]), '5rk1/3p2pp/1pp1p3/p1q5/6P1/2P1Q2K/P3R2P/8 w - - 2 27', "owner's game: final position");
  return `52 moves: ${game.moves.map((m) => m.san).join(' ')}`;
});

// ---------- 3. random games ----------

// mulberry32: a small seeded random number generator, so every run plays the same "random" games.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = seeded(20261006);
const pick = (list) => list[Math.floor(rng() * list.length)];

// Starting points besides the normal one, chosen for castling, en passant, promotions and disambiguation.
const STARTS = [
  KIWIPETE,
  POSITION_3,
  POSITION_4,
  POSITION_4_MIRRORED,
  POSITION_5,
  POSITION_6,
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', // Black moves first: "1. ... e5"
  '4k3/1P4P1/8/8/8/8/1p4p1/4K3 w - - 0 1', // promotions right away
  'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', // castling, rook moves needing a file or rank
  'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', // castling once the pawns move
  '6k1/8/8/8/8/Q7/8/Q1Q4K w - - 0 1', // three queens: moves needing the whole starting square
  'n1n3k1/8/8/N7/n7/8/8/N1N3K1 w - - 0 1', // three knights each, all able to reach b3 / b6
];

// Comment text that looks like PGN syntax, which must stay inside the comment.
const COMMENT_WORDS = ['good', 'idea', 'threat (Qh5)', 'only move', 'e4 e5', '1-0?', '$1', 'see ; here', '[not a tag]', 'a (nested (side) line)', '12...', 'O-O'];
const randomComment = () => Array.from({ length: 1 + Math.floor(rng() * 4) }, () => pick(COMMENT_WORDS)).join(' ');

// Things a PGN may contain that must not change the main line: annotation glyphs, NAGs,
// side lines (nested, with comments full of brackets), ;comments and %escape lines.
const NOISE = [
  () => pick(['!', '?', '!!', '??', '!?', '?!']),
  () => ` $${1 + Math.floor(rng() * 200)}`,
  () => ' (1... d5 2. c4 {a side line (with brackets)} (2. Nf3 $1) Qxd4?)',
  () => ' (12. Qh5+ Ke7 ; a comment to the end of the line (\n13. Qxf7#)',
  () => ' ; rest-of-line comment with ( and {\n',
  () => '\n% escape line, also ignored ( {\n',
];

function addNoise(pgn) {
  const split = pgn.indexOf('\n\n') + 2; // the moves start after the blank line that ends the tags
  const tokens = split > 1 ? pgn.slice(split).match(/\{[^}]*\}|\S+/g) : null;
  if (!tokens) return pgn;
  const noisy = tokens.map((token) => (/^[a-hNBRQKO]/.test(token) && rng() < 0.3 ? token + pick(NOISE)() : token));
  return pgn.slice(0, split) + noisy.join(' ');
}

// Line breaks may fall between any two tokens, even between a move number and its move or inside a comment.
// (chess.js's own pgn({ maxWidth }) is not used: it glues tokens together, like "Kf639.", when it wraps a comment.)
function wrap(pgn) {
  const split = pgn.indexOf('\n\n') + 2;
  return split > 1 ? pgn.slice(0, split) + pgn.slice(split).replace(/ /g, () => (rng() < 0.15 ? '\n' : ' ')) : pgn;
}

// Mostly random moves, but rarer kinds of move are favoured whenever they are possible.
function chooseMove(fen, options) {
  const ep = fen.split(' ')[3]; // chess.js names this square only when en passant is legal
  const enPassant = options.filter((san) => /^[a-h]x/.test(san) && san.slice(2, 4) === ep);
  const castles = options.filter((san) => san.startsWith('O-O'));
  const promotions = options.filter((san) => san.includes('='));
  const fullSquare = options.filter((san) => /^[NBRQK][a-h][1-8]x?[a-h][1-8]/.test(san)); // like "Qa1b2"
  if (enPassant.length && rng() < 0.7) return pick(enPassant);
  if (castles.length && rng() < 0.5) return pick(castles);
  if (promotions.length && rng() < 0.7) return pick(promotions);
  if (fullSquare.length && rng() < 0.7) return pick(fullSquare);
  return pick(options);
}

section('random games', () => {
  const GAMES = 300;
  const seen = { 'O-O': 0, 'O-O-O': 0, 'en passant': 0, '=Q': 0, '=R': 0, '=B': 0, '=N': 0, 'by file': 0, 'by rank': 0, 'by square': 0, '+': 0, '#': 0 };
  let plies = 0;
  let fenStarts = 0;
  const layouts = { plain: 0, wrapped: 0, noisy: 0 };
  let comments = 0;
  for (let game = 1; game <= GAMES; game++) {
    const start = rng() < 0.6 ? START_FEN : pick(STARTS);
    const chess = new Chess(start);
    const startFen = chess.fen();
    let fen = startFen;
    let state = parseFen(start);
    const history = []; // chess.js's record of every move played
    if (rng() < 0.2) chess.setComment(randomComment());
    for (let ply = 1; ply <= 150; ply++) {
      // Play the game with our engine alongside chess.js, comparing the legal moves on the way.
      const options = chess.moves(); // none: checkmate or stalemate
      if (!options.length || chess.isDrawByFiftyMoves() || chess.isInsufficientMaterial() || chess.isThreefoldRepetition()) break;
      const legal = legalMoves(state);
      if (!same(legal.length, options.length, `game ${game} ply ${ply}: number of legal moves in ${fen}`)) break;
      if (ply % 10 === 1) same(legal.map((move) => toSan(state, move)).sort(), options.slice().sort(), `game ${game} ply ${ply}: SAN of every legal move in ${fen}`);
      const san = chooseMove(fen, options);
      state = makeMove(state, sanToMove(state, san));
      history.push(chess.move(san));
      fen = history[history.length - 1].after;
      if (!same(toFen(state), fen, `game ${game} ply ${ply}: FEN after ${san}`)) break;
      if (rng() < 0.08) chess.setComment(randomComment());
    }

    // Export the game as PGN with chess.js (as is, with random line breaks, or with noise added) and read it back.
    const layout = pick(['plain', 'wrapped', 'noisy']);
    const pgn = { plain: (text) => text, wrapped: wrap, noisy: addNoise }[layout](chess.pgn());
    let ours;
    try {
      ours = parsePgn(pgn);
    } catch (error) {
      check(false, `game ${game}: parsePgn threw "${error.message}" for:\n${pgn}`);
      continue;
    }
    const what = `game ${game} (${layout})`;
    compareGame(ours, startFen, history, what);
    same(sortedTags(ours.headers), sortedTags(chess.getHeaders()), `${what}: headers`);
    same(ours.result, '*', `${what}: result`);
    const notes = new Map(chess.getComments().map(({ fen: at, comment }) => [at, comment]));
    same(ours.startComment, notes.get(startFen) ?? '', `${what}: comment before the first move`);
    history.forEach((move, i) => same(ours.moves[i]?.comment, notes.get(move.after) ?? '', `${what}: comment after move ${i + 1}`));

    plies += history.length;
    fenStarts += start !== START_FEN;
    layouts[layout]++;
    comments += notes.size;
    for (const move of history) {
      if (move.isKingsideCastle()) seen['O-O']++;
      if (move.isQueensideCastle()) seen['O-O-O']++;
      if (move.isEnPassant()) seen['en passant']++;
      if (move.promotion) seen[`=${move.promotion.toUpperCase()}`]++;
      const extra = /^[NBRQK]([a-h]?[1-8]?)x?[a-h][1-8]/.exec(move.san)?.[1] ?? '';
      if (extra) seen[extra.length === 2 ? 'by square' : /[a-h]/.test(extra) ? 'by file' : 'by rank']++;
      if (/[+#]$/.test(move.san)) seen[move.san.slice(-1)]++;
    }
  }
  for (const [kind, count] of Object.entries(seen)) check(count > 0, `random games never produced: ${kind}`);
  return [
    `${GAMES} games, ${plies} moves, ${comments} comments; ${fenStarts} games start from a FEN tag`,
    `PGN read back as exported: ${layouts.plain}, with random line breaks: ${layouts.wrapped}, with glyphs/NAGs/side lines/;comments/%lines added: ${layouts.noisy}`,
    `castling O-O ${seen['O-O']}, O-O-O ${seen['O-O-O']}; en passant ${seen['en passant']}; promotions =Q ${seen['=Q']}, =R ${seen['=R']}, =B ${seen['=B']}, =N ${seen['=N']}`,
    `disambiguated by file ${seen['by file']}, by rank ${seen['by rank']}, by square ${seen['by square']}; checks ${seen['+']}, mates ${seen['#']}`,
  ].join('\n');
});

// ---------- 4. edge cases ----------

section('edge cases', () => {
  // Squares and FEN.
  same([squareName(0), squareName(7), squareName(56), squareName(63), squareIndex('e4')], ['a1', 'h1', 'a8', 'h8', 28], 'square names');
  check(Array.from({ length: 64 }, (_, i) => squareIndex(squareName(i)) === i).every(Boolean), 'squareIndex(squareName(i)) === i for every square');
  throws(() => squareIndex('i9'), /not a square/, 'squareIndex rejects "i9"');
  const start = parseFen(START_FEN);
  same([start.board[0], start.board[4], start.board[12], start.board[60], start.board[63]], ['R', 'K', 'P', 'k', 'r'], 'start position pieces');
  same({ ...start, board: undefined }, { turn: 'w', castling: 'KQkq', ep: -1, halfmove: 0, fullmove: 1 }, 'start position fields');
  for (const [, fen] of PERFT) same(toFen(parseFen(fen)), new Chess(fen).fen(), `FEN round trip of ${fen}`);
  same(toFen(parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -')), KIWIPETE, 'FEN without move counters');
  same(parseFen('4k3/8/8/8/8/8/8/4K3 w KQkq - 0 1').castling, '', 'castling rights without the rooks are dropped');
  same(parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 1').ep, -1, 'en passant square without a pawn that jumped is dropped');
  throws(() => parseFen('not a fen'), /Invalid FEN/, 'parseFen rejects nonsense');
  throws(() => parseFen('8/8/8/8/8/8/8/8 w - - 0 1'), /king/, 'parseFen needs both kings');
  throws(() => parseFen('rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), /Invalid FEN/, 'parseFen rejects a bad rank');
  throws(() => parseFen('k7/8/8/8/8/8/8/R3K3 w - - 0 1'), /just moved is in check/, 'parseFen rejects a king that could be captured');

  // Move objects, purity and check.
  same(Object.keys(legalMoves(start)[0]).sort(), ['captured', 'castle', 'enPassant', 'from', 'piece', 'promotion', 'to'], 'move shape');
  const frozen = Object.freeze({ ...start, board: Object.freeze(start.board.slice()) });
  const before = JSON.stringify(frozen);
  const next = makeMove(frozen, sanToMove(frozen, 'e4'));
  same(JSON.stringify(frozen), before, 'makeMove does not change its input');
  same(toFen(next), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'makeMove result');
  const fools = agreesWithChessJs('1. f3 e5 2. g4 Qh4 0-1', "fool's mate");
  same([fools.moves[3].san, inCheck(fools.positions[4]), legalMoves(fools.positions[4]).length, fools.result], ['Qh4#', true, 0, '0-1'], 'checkmate gets "#"');
  same(inCheck(fools.positions[3]), false, 'inCheck is false when not in check');

  // Castling: not out of, through or into check; b1 may be attacked.
  for (const fen of ['4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1', '3rk3/8/8/8/8/8/8/R3K2R w KQ - 0 1', '1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    '4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1', '4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1']) {
    sameMovesAsChessJs(fen, 'castling');
  }
  const rookTaken = makeMove(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), sanToMove(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'Rxh8+'));
  same(rookTaken.castling, 'Qq', 'capturing a rook at home ends that castling right');

  // En passant: a normal capture, a capture that would expose the king along the rank, one that answers a check.
  const ep = agreesWithChessJs('1. e4 Nf6 2. e5 d5 3. exd6 *', 'en passant');
  same([ep.moves[4].san, ep.moves[4].enPassant, ep.moves[4].captured, toFen(ep.positions[4]).split(' ')[3]], ['exd6', true, 'p', 'd6'], 'en passant capture');
  same(parsePgn('1. e4 Nf6 2. e5 d5 3. exd6 e.p. Nc6 *').moves.map((m) => m.san), ['e4', 'Nf6', 'e5', 'd5', 'exd6', 'Nc6'], '"e.p." after a move is ignored');
  same(legalMoves(parseFen('8/8/8/KPp4r/8/8/8/7k w - c6 0 2')).some((m) => m.enPassant), false, 'en passant that would expose the king is illegal');
  same(toFen(parseFen('8/8/8/KPp4r/8/8/8/7k w - c6 0 2')).split(' ')[3], '-', 'FEN leaves out an en passant square that cannot be used');
  sameMovesAsChessJs('8/8/8/KPp4r/8/8/8/7k w - c6 0 2', 'en passant pin');
  sameMovesAsChessJs('4k3/8/8/3pP3/4K3/8/8/8 w - d6 0 2', 'en passant out of check');

  // Disambiguation: by file, by rank, by whole square, and none when the other knight is pinned.
  const sans = (fen) => {
    const state = parseFen(fen);
    return legalMoves(state).map((move) => toSan(state, move));
  };
  check(sans('6k1/8/8/8/8/8/8/R4RK1 w - - 0 1').includes('Rad1'), 'SAN "Rad1" (file)');
  check(sans('6k1/8/8/R7/8/8/8/R5K1 w - - 0 1').includes('R1a3'), 'SAN "R1a3" (rank)');
  const queens = sans('6k1/8/8/8/8/Q7/8/Q1Q4K w - - 0 1');
  check(['Qa1b2', 'Q3b2', 'Qcb2'].every((san) => queens.includes(san)), 'SAN "Qa1b2", "Q3b2", "Qcb2" (square, rank, file)');
  for (const fen of ['6k1/8/8/8/8/8/8/R4RK1 w - - 0 1', '6k1/8/8/R7/8/8/8/R5K1 w - - 0 1', '6k1/8/8/8/8/Q7/8/Q1Q4K w - - 0 1', 'n1n3k1/8/n7/8/8/N7/8/N1N3K1 b - - 0 1']) {
    sameMovesAsChessJs(fen, 'disambiguation');
  }
  const pinned = parseFen('r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4');
  same(toSan(pinned, sanToMove(pinned, 'Nge7')), 'Ne7', 'no disambiguation when the other knight is pinned (and "Nge7" is still accepted)');
  throws(() => sanToMove(parseFen('6k1/8/8/8/8/Q7/8/Q1Q4K w - - 0 1'), 'Qb2'), /ambiguous/, 'sanToMove: "Qb2" is ambiguous');

  // sanToMove is forgiving about notation.
  const afterE4D5 = parsePgn('1. e4 d5').positions[2];
  same(squareName(sanToMove(afterE4D5, 'ed5').from), 'e4', 'capture without "x"');
  throws(() => sanToMove(afterE4D5, 'd5'), /not legal/, 'a pawn capture must name the file it leaves');
  for (const san of ['Nf3', 'Ng1f3', 'Ng1-f3', 'Nf3!?', 'Nf3+']) same(toSan(start, sanToMove(start, san)), 'Nf3', `sanToMove "${san}"`);
  for (const san of ['e4', 'e2e4', 'e2-e4']) same(toSan(start, sanToMove(start, san)), 'e4', `sanToMove "${san}"`);
  throws(() => sanToMove(start, 'Ke2'), /^Ke2 is not legal in this position$/, 'sanToMove: illegal move');
  throws(() => sanToMove(start, 'Nonsense'), /not legal/, 'sanToMove: not a move at all');

  // Promotions: "e8Q", "e8=Q", "e8q", capture-promotions, Black promoting, and the check sign after promoting.
  const promote = (fen, move) => parsePgn(`[FEN "${fen}"]\n\n${move} *`).moves[0];
  for (const written of ['1. e8Q', '1. e8=Q', '1. e8q']) same(promote('5r1k/4P3/8/8/8/8/8/4K3 w - - 0 1', written).san, 'e8=Q', `promotion written "${written}"`);
  const underpromotion = promote('5r1k/4P3/8/8/8/8/8/4K3 w - - 0 1', '1. exf8N');
  same([underpromotion.san, underpromotion.promotion, underpromotion.captured], ['exf8=N', 'N', 'r'], 'capture-promotion to a knight');
  agreesWithChessJs('[FEN "5r1k/4P3/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. exf8=R+ Kh7 *', 'promotion with check');
  agreesWithChessJs('[FEN "4k3/8/8/8/8/8/3p4/7K b - - 0 1"]\n\n1... d1Q+ 2. Kg2 *', 'Black promotes');
  throws(() => parsePgn('[FEN "5r1k/4P3/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. e8 *'), /Move 1\. e8 is not legal/, 'promotion without a piece');

  // PGN: comments before and after moves (several in a row are joined; chess-site commands are removed).
  const commented = parsePgn('{Before the game} 1. e4 {King pawn} e5 {Same\n  again} 2. Nf3 {one} {two} Nc6 {[%clk 0:09:58]} 3. Bb5 {Good [%eval 0.3] move} *');
  same(commented.startComment, 'Before the game', 'comment before the first move');
  same(commented.moves.map((m) => m.comment), ['King pawn', 'Same again', 'one two', '', 'Good move'], 'comments after moves');
  agreesWithChessJs('{Before the game} 1. e4 {King pawn} e5 {Same} 2. Nf3 Nc6 *', 'comments');

  // PGN: nested side lines (skipped, even with brackets in their comments), NAGs and glyphs.
  const nested = agreesWithChessJs('1. e4 (1. d4 d5 (1... Nf6 2. c4 (2. Nf3 g6)) 2. c4) 1... e5 {main (line)} (1... c5 {Sicilian (open)} 2. Nf3) 2. Nf3 (2. f4 exf4 (2... d5)) 2... Nc6 *', 'nested side lines');
  same([nested.moves.map((m) => m.san), nested.moves[1].comment], [['e4', 'e5', 'Nf3', 'Nc6'], 'main (line)'], 'nested side lines are skipped');
  const annotated = agreesWithChessJs('1. e4! $1 e5? $2 2. Nf3!! $3 Nc6?! $6 3. Bb5!? $5 a6?? $4 *', 'NAGs and glyphs');
  same(annotated.moves.map((m) => m.san), ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], 'NAGs and glyphs are ignored');

  // PGN: "0-0" castling both ways.
  const castled = agreesWithChessJs('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. 0-0 d6 5. d3 Bg4 6. Nc3 Qd7 7. Be3 0-0-0 *', '0-0 castling');
  same([castled.moves[6].san, castled.moves[13].san, castled.moves[13].castle], ['O-O', 'O-O-O', 'Q'], '"0-0" and "0-0-0" read as castling');

  // PGN: starting from a FEN tag (with or without SetUp), including Black to move first.
  const setup = agreesWithChessJs('[SetUp "1"]\n[FEN "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"]\n\n3. Bb5 a6 4. Ba4 Nf6 *', 'FEN tag');
  same(setup.moves.map((m) => `${m.number}${m.color}`), ['3w', '3b', '4w', '4b'], 'move numbers continue from the FEN');
  const blackFirst = agreesWithChessJs('[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"]\n\n1... c5 2. Nf3 *', 'FEN tag, Black first');
  same([blackFirst.moves[0].number, blackFirst.moves[0].color], [1, 'b'], 'Black moves first');

  // PGN: illegal and ambiguous moves give an error that names the move.
  const ownerMoves = OWNER_PGN.slice(OWNER_PGN.indexOf('1. e4'));
  throws(() => parsePgn(ownerMoves.slice(0, ownerMoves.indexOf('Nxd2+')) + 'Qh4'), /^Move 12\.\.\. Qh4 is not legal in this position$/, 'illegal Black move');
  throws(() => parsePgn('1. e4 e5 2. Ke3 *'), /^Move 2\. Ke3 is not legal in this position$/, 'illegal White move');
  throws(() => parsePgn('1. Nf3 Nf6 2. d3 Nc6 3. Nd2 *'), /^Move 3\. Nd2 is ambiguous in this position$/, 'ambiguous move');
  same(agreesWithChessJs('1. Nf3 Nf6 2. d3 Nc6 3. Nbd2 *', 'Nbd2').moves[4].san, 'Nbd2', 'disambiguated knight move');
  // An unclosed side line would hide the rest of the game, so it is an error (chess.js rejects it too).
  throws(() => parsePgn('1. e4 e5 (1... c5 2. Nf3 2. Nf3 Nc6 3. Bb5 a6 1-0'), /never closed/, 'an unclosed side line');
  throws(() => parsePgn('1. e4 e5 2. Nf3 (A note written in brackets 2... Nc6 0-1'), /never closed/, 'a note in an unclosed bracket');

  // PGN: odd but valid layouts. Escaped quotes in tags, CRLF line ends, a BOM, a %escape line,
  // a ;comment, glued move numbers ("1.e4", "1...e5"), "2. ... Nc6", and a second game after the first.
  const odd = parsePgn('\uFEFF[Event "The \\"Big\\" One \\\\ 2"]\r\n[Result "1-0"]\r\n\r\n% ignored (\r\n1.e4 ; ignored to the end of the line (\r\n1...e5 2.Nf3 2. ... Nc6 3. Bb5\r\n1-0\r\n\r\n[Event "Next game"]\r\n\r\n1. d4 *');
  same([odd.headers.Event, odd.moves.map((m) => m.san), odd.result], ['The "Big" One \\ 2', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], '1-0'], 'odd layout');
  same(odd.moves.map((m) => m.comment).join(''), '', ';comments are ignored');
  const empty = parsePgn('[Event "No moves"]\n[Result "1/2-1/2"]\n\n');
  same([empty.moves.length, empty.positions.length, toFen(empty.positions[0]), empty.result], [0, 1, START_FEN, '1/2-1/2'], 'game without moves');
  same(parsePgn('1. e4').result, '*', 'result defaults to "*"');
  same(parsePgn('').positions.length, 1, 'empty text');
});

// ---------- summary ----------

if (failures.length) {
  console.log(`\n${failures.length} check(s) FAILED, ${passed} passed:`);
  for (const failure of failures.slice(0, 25)) console.log(`  - ${failure}`);
  if (failures.length > 25) console.log(`  ...and ${failures.length - 25} more`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${passed} checks passed.`);
}
