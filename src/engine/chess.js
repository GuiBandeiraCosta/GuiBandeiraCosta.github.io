// Chess rules and a PGN reader for the game viewer in the Chess House.
// It never touches the page, so the browser and the Node test (tests/chess.test.mjs, which checks it
// against the chess.js library) run exactly the same code.
//
// Squares are numbers 0..63: index = file + 8 * rank, so a1 = 0, h1 = 7, a8 = 56, h8 = 63.
// Pieces are letters as in FEN: 'PNBRQK' are White, 'pnbrqk' are Black, and '' is an empty square.
// A position ("state") is a plain object. Functions return new objects and never change the ones passed in.

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FILES = 'abcdefgh';
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_LINES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_LINES = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const SLIDES = { r: ROOK_LINES, b: BISHOP_LINES, q: [...ROOK_LINES, ...BISHOP_LINES] };
const PROMOTIONS = ['q', 'r', 'b', 'n'];

// For each castling right: where the king and rook start and land, and the squares between them that must be empty.
const CASTLING = {
  K: { king: 4, kingTo: 6, rook: 7, rookTo: 5, empty: [5, 6] },
  Q: { king: 4, kingTo: 2, rook: 0, rookTo: 3, empty: [1, 2, 3] },
  k: { king: 60, kingTo: 62, rook: 63, rookTo: 61, empty: [61, 62] },
  q: { king: 60, kingTo: 58, rook: 56, rookTo: 59, empty: [57, 58, 59] },
};
// A move from or to one of these squares ends these rights: the king or a rook left home, or a rook was taken there.
const RIGHTS_LOST = { 0: 'Q', 4: 'KQ', 7: 'K', 56: 'q', 60: 'kq', 63: 'k' };

const colorOf = (piece) => (piece === '' ? '' : piece === piece.toUpperCase() ? 'w' : 'b');
const opponent = (color) => (color === 'w' ? 'b' : 'w');
const pieceOf = (type, color) => (color === 'w' ? type.toUpperCase() : type); // ('n', 'w') -> 'N'

/** The square `df` files and `dr` ranks away from `square`, or -1 when that is off the board. */
function step(square, df, dr) {
  const file = (square % 8) + df;
  const rank = Math.floor(square / 8) + dr;
  return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? file + 8 * rank : -1;
}

export function squareName(index) {
  return FILES[index % 8] + (Math.floor(index / 8) + 1);
}

export function squareIndex(name) {
  if (!/^[a-h][1-8]$/.test(name)) throw new Error(`"${name}" is not a square`);
  return FILES.indexOf(name[0]) + 8 * (Number(name[1]) - 1);
}

/** Reads a FEN string. Only the piece placement is required; missing fields get the usual defaults. */
export function parseFen(fen) {
  const [placement, turn = 'w', castling = '-', ep = '-', halfmove = '0', fullmove = '1'] = String(fen).trim().split(/\s+/);
  const fail = (problem) => {
    throw new Error(`Invalid FEN "${fen}": ${problem}`);
  };
  const ranks = placement.split('/');
  if (ranks.length !== 8) fail('it needs 8 ranks separated by "/"');
  const board = Array(64).fill('');
  ranks.forEach((row, i) => {
    const rank = 7 - i; // FEN lists rank 8 first
    let file = 0;
    for (const char of row) {
      if (char >= '1' && char <= '8') file += Number(char);
      else if ('pnbrqkPNBRQK'.includes(char) && file < 8) board[file++ + 8 * rank] = char;
      else fail(`rank ${rank + 1} is not valid`);
    }
    if (file !== 8) fail(`rank ${rank + 1} does not have 8 squares`);
  });
  const count = (piece) => board.filter((p) => p === piece).length;
  if (count('K') !== 1 || count('k') !== 1) fail('each side needs exactly one king');
  const edges = [...board.slice(0, 8), ...board.slice(56)];
  if (edges.includes('P') || edges.includes('p')) fail('a pawn is on the first or last rank');
  if (turn !== 'w' && turn !== 'b') fail('the side to move must be "w" or "b"');
  // Otherwise the side to move could capture the king, which never happens in a real game.
  if (attacked(board, board.indexOf(pieceOf('k', opponent(turn))), turn)) fail('the side that just moved is in check');
  if (!/^(-|[KQkq]+)$/.test(castling)) fail('castling must be "-" or letters from "KQkq"');
  if (!/^(-|[a-h][36])$/.test(ep)) fail('the en passant square must be "-" or a square on rank 3 or 6');
  if (!/^\d+$/.test(halfmove) || !/^\d+$/.test(fullmove)) fail('the move counters must be whole numbers');

  // Keep only the castling rights whose king and rook are still on their starting squares.
  const rights = [...'KQkq'].filter((right) => {
    const { king, rook } = CASTLING[right];
    const color = colorOf(right);
    return castling.includes(right) && board[king] === pieceOf('k', color) && board[rook] === pieceOf('r', color);
  });
  // Keep the en passant square only if an enemy pawn really just jumped over it.
  let epSquare = ep === '-' ? -1 : squareIndex(ep);
  if (epSquare >= 0) {
    const back = turn === 'w' ? -8 : 8; // from the jumped-over square towards the pawn that jumped
    const rightRank = Math.floor(epSquare / 8) === (turn === 'w' ? 5 : 2);
    const jumped = board[epSquare + back] === pieceOf('p', opponent(turn)) && board[epSquare] === '' && board[epSquare - back] === '';
    if (!rightRank || !jumped) epSquare = -1;
  }
  return {
    board,
    turn,
    castling: rights.join(''),
    ep: epSquare,
    halfmove: Number(halfmove),
    fullmove: Math.max(1, Number(fullmove)),
  };
}

/** The FEN string of a position. */
export function toFen(state) {
  const ranks = [];
  for (let rank = 7; rank >= 0; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = state.board[file + 8 * rank];
      if (piece === '') {
        empty++;
      } else {
        row += (empty || '') + piece;
        empty = 0;
      }
    }
    ranks.push(row + (empty || ''));
  }
  // Like chess.js, name the en passant square only when an en passant capture is actually legal.
  const ep = state.ep >= 0 && legalMoves(state).some((move) => move.enPassant) ? squareName(state.ep) : '-';
  return [ranks.join('/'), state.turn, state.castling || '-', ep, state.halfmove, state.fullmove].join(' ');
}

/** Is `square` attacked by a piece of `color`? */
function attacked(board, square, color) {
  const has = (target, type) => target >= 0 && board[target] === pieceOf(type, color);
  const back = color === 'w' ? -1 : 1; // pawns attack diagonally forwards, so look one rank behind the square
  if (has(step(square, -1, back), 'p') || has(step(square, 1, back), 'p')) return true;
  if (KNIGHT_JUMPS.some(([df, dr]) => has(step(square, df, dr), 'n'))) return true;
  if (KING_STEPS.some(([df, dr]) => has(step(square, df, dr), 'k'))) return true;
  for (const [type, lines] of [['r', ROOK_LINES], ['b', BISHOP_LINES]]) {
    for (const [df, dr] of lines) {
      let target = step(square, df, dr);
      while (target >= 0 && board[target] === '') target = step(target, df, dr);
      if (has(target, type) || has(target, 'q')) return true;
    }
  }
  return false;
}

/** The board after a move (only the pieces; makeMove updates the rest of the state). */
function play(board, move) {
  const next = board.slice();
  next[move.from] = '';
  next[move.to] = move.promotion || move.piece;
  if (move.enPassant) next[move.to + (colorOf(move.piece) === 'w' ? -8 : 8)] = '';
  if (move.castle) {
    const { rook, rookTo } = CASTLING[pieceOf(move.castle.toLowerCase(), colorOf(move.piece))];
    next[rookTo] = next[rook];
    next[rook] = '';
  }
  return next;
}

/** Every move by the side to move, including ones that would leave its own king in check. */
function candidateMoves(state) {
  const { board, turn } = state;
  const moves = [];
  const add = (from, to, extra) => {
    moves.push({ from, to, piece: board[from], captured: board[to], promotion: '', castle: '', enPassant: false, ...extra });
  };
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (colorOf(piece) !== turn) continue;
    const type = piece.toLowerCase();
    if (type === 'p') {
      const forward = turn === 'w' ? 1 : -1;
      // Reaching the last rank always promotes, so such a move comes in four versions.
      const addPawn = (to) => {
        if (to >= 8 && to < 56) add(from, to);
        else for (const promotion of PROMOTIONS) add(from, to, { promotion: pieceOf(promotion, turn) });
      };
      const one = step(from, 0, forward);
      if (board[one] === '') {
        addPawn(one);
        const two = step(from, 0, 2 * forward);
        if (Math.floor(from / 8) === (turn === 'w' ? 1 : 6) && board[two] === '') add(from, two);
      }
      for (const df of [-1, 1]) {
        const to = step(from, df, forward);
        if (to < 0) continue;
        if (colorOf(board[to]) === opponent(turn)) addPawn(to);
        else if (to === state.ep) add(from, to, { captured: pieceOf('p', opponent(turn)), enPassant: true });
      }
    } else if (type === 'n' || type === 'k') {
      for (const [df, dr] of type === 'n' ? KNIGHT_JUMPS : KING_STEPS) {
        const to = step(from, df, dr);
        if (to >= 0 && colorOf(board[to]) !== turn) add(from, to);
      }
    } else {
      for (const [df, dr] of SLIDES[type]) {
        for (let to = step(from, df, dr); to >= 0 && colorOf(board[to]) !== turn; to = step(to, df, dr)) {
          add(from, to);
          if (board[to] !== '') break; // captured something, so the line ends here
        }
      }
    }
  }
  for (const right of state.castling) {
    const { king, kingTo, rook, rookTo, empty } = CASTLING[right];
    if (colorOf(right) !== turn || board[king] !== pieceOf('k', turn) || board[rook] !== pieceOf('r', turn)) continue;
    if (empty.some((square) => board[square] !== '')) continue;
    // The king may not castle out of, through or into check.
    if ([king, rookTo, kingTo].some((square) => attacked(board, square, opponent(turn)))) continue;
    add(king, kingTo, { castle: right.toUpperCase() });
  }
  return moves;
}

/** All legal moves: { from, to, piece, captured, promotion, castle ('K', 'Q' or ''), enPassant }. */
export function legalMoves(state) {
  const king = pieceOf('k', state.turn);
  const home = state.board.indexOf(king);
  // Try each move and keep it only if our own king is not attacked afterwards.
  return candidateMoves(state).filter((move) => {
    const board = play(state.board, move);
    return !attacked(board, move.piece === king ? move.to : home, opponent(state.turn));
  });
}

/** The position after `move`, which must be one of legalMoves(state). */
export function makeMove(state, move) {
  const pawn = move.piece === 'P' || move.piece === 'p';
  const lost = (RIGHTS_LOST[move.from] || '') + (RIGHTS_LOST[move.to] || '');
  return {
    board: play(state.board, move),
    turn: opponent(state.turn),
    castling: [...state.castling].filter((right) => !lost.includes(right)).join(''),
    ep: pawn && Math.abs(move.to - move.from) === 16 ? (move.from + move.to) / 2 : -1,
    halfmove: pawn || move.captured ? 0 : state.halfmove + 1,
    fullmove: state.turn === 'b' ? state.fullmove + 1 : state.fullmove,
  };
}

/** Is the side to move in check? */
export function inCheck(state) {
  return attacked(state.board, state.board.indexOf(pieceOf('k', state.turn)), opponent(state.turn));
}

/** Standard algebraic notation for a legal move, such as 'Nbd7', 'exd5', 'e8=Q+' or 'O-O'. */
export function toSan(state, move) {
  return sanOf(state, move, legalMoves(state));
}

function sanOf(state, move, legal) {
  let san;
  if (move.castle) {
    san = move.castle === 'K' ? 'O-O' : 'O-O-O';
  } else if (move.piece === 'P' || move.piece === 'p') {
    const capture = move.captured ? `${squareName(move.from)[0]}x` : ''; // a pawn capture names the file it leaves
    const promotion = move.promotion ? `=${move.promotion.toUpperCase()}` : '';
    san = capture + squareName(move.to) + promotion;
  } else {
    san = move.piece.toUpperCase() + disambiguation(move, legal) + (move.captured ? 'x' : '') + squareName(move.to);
  }
  const next = makeMove(state, move);
  return inCheck(next) ? san + (legalMoves(next).length ? '+' : '#') : san;
}

// When another piece of the same kind could also go to the same square, SAN adds the starting file
// if that tells them apart, otherwise the starting rank, otherwise both.
function disambiguation(move, legal) {
  const rivals = legal.filter((other) => other.piece === move.piece && other.to === move.to && other.from !== move.from);
  if (!rivals.length) return '';
  const from = squareName(move.from);
  if (rivals.every((other) => squareName(other.from)[0] !== from[0])) return from[0];
  if (rivals.every((other) => squareName(other.from)[1] !== from[1])) return from[1];
  return from;
}

/**
 * The legal move a SAN token stands for. Also accepts common variations: '0-0' castling, a missing 'x',
 * promotion without '=' ('e8Q'), extra starting squares ('Ng1f3', 'e2-e4') and trailing '+', '#', '!' or '?'.
 */
export function sanToMove(state, san) {
  return findMove(san, legalMoves(state));
}

// An optional piece letter, an optional starting file and rank, an optional 'x' (or ':' or '-'),
// the target square, and an optional promotion piece with or without '='.
const SAN_MOVE = /^([PNBRQK])?([a-h])?([1-8])?[x:-]?([a-h][1-8])=?([NBRQnbrq])?$/;

function findMove(san, legal) {
  const text = String(san).trim().replace(/[+#!?]+$/, '');
  const castle = /^([O0o])-\1(-\1)?$/.exec(text);
  const parts = SAN_MOVE.exec(text);
  const matches = (move) => {
    if (castle) return move.castle === (castle[2] ? 'Q' : 'K');
    if (!parts) return false;
    const [, letter = 'P', file, rank, to, promotion] = parts;
    const from = squareName(move.from);
    return (
      move.piece.toUpperCase() === letter &&
      squareName(move.to) === to &&
      // A pawn move written without a starting file is a straight push, never a capture.
      (file ? from[0] === file : letter !== 'P' || from[0] === to[0]) &&
      (!rank || from[1] === rank) &&
      (move.promotion ? move.promotion.toUpperCase() === promotion?.toUpperCase() : !promotion)
    );
  };
  const found = legal.filter(matches);
  if (found.length !== 1) throw new Error(`${san} is ${found.length ? 'ambiguous' : 'not legal'} in this position`);
  return found[0];
}

/** Counts the positions reached after exactly `depth` moves (the standard test for move generators). */
export function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(state);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) nodes += perft(makeMove(state, move), depth - 1);
  return nodes;
}

// One PGN token per match. The kinds are tried in this order:
const PGN_TOKEN = new RegExp(
  [
    String.raw`\[\s*(?<tag>\w+)\s*"(?<value>(?:\\.|[^"\\])*)"\s*\]`, // a [Tag "value"] pair
    String.raw`\{(?<comment>[^}]*)\}`, // a {comment}
    ';.*', // a comment to the end of the line (ignored)
    '^%.*', // an escaped line (ignored)
    String.raw`(?<open>\()|(?<close>\))`, // the start or end of a side line
    String.raw`\$\d+`, // a numbered annotation such as $1 (ignored)
    String.raw`(?<word>[^\s{}()[\];$]+)`, // anything else: a move, a move number or the result
  ].join('|'),
  'gm',
);
const RESULTS = ['1-0', '0-1', '1/2-1/2', '*'];

/**
 * Reads the first game of a PGN text. Side lines ( ... ) are skipped; {comments} go to the move before them.
 * Returns { headers, moves, positions, startComment, result }, where positions[i] is the position after i moves.
 */
export function parsePgn(text) {
  const headers = {};
  const tokens = []; // the main line's moves and comments, in order
  let result = '';
  let depth = 0; // how many ( variations ) deep we are; everything inside them is skipped
  for (const { groups: token } of String(text).matchAll(PGN_TOKEN)) {
    if (token.open || token.close) {
      depth = Math.max(0, depth + (token.open ? 1 : -1));
    } else if (depth > 0) {
      continue;
    } else if (token.tag) {
      if (tokens.some((t) => t.san)) break; // a tag after the moves starts the next game in the file
      headers[token.tag] = token.value.replace(/\\(.)/g, '$1');
    } else if (token.comment !== undefined) {
      tokens.push({ comment: token.comment });
    } else if (RESULTS.includes(token.word)) {
      result = token.word;
      break;
    } else if (token.word) {
      // Drop the move number ("12." or "12...") and annotation glyphs ("!", "?!"...): what is left is the move.
      const san = token.word.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
      if (san && !/^(\d+|\.+|e\.p\.)$/.test(san)) tokens.push({ san });
    }
  }
  // An unclosed "(" would otherwise hide the rest of the game (and its result) without any error.
  if (depth > 0) throw new Error('A side line "(" is never closed with ")"');

  let state = parseFen(headers.FEN || START_FEN);
  const positions = [state];
  const moves = [];
  let startComment = '';
  for (const token of tokens) {
    if (token.san === undefined) {
      const last = moves[moves.length - 1];
      if (last) last.comment = addComment(last.comment, token.comment);
      else startComment = addComment(startComment, token.comment);
      continue;
    }
    const legal = legalMoves(state);
    let move;
    try {
      move = findMove(token.san, legal);
    } catch (error) {
      throw new Error(`Move ${state.fullmove}${state.turn === 'w' ? '.' : '...'} ${error.message}`);
    }
    moves.push({ san: sanOf(state, move, legal), ...move, color: state.turn, number: state.fullmove, comment: '' });
    state = makeMove(state, move);
    positions.push(state);
  }
  return { headers, moves, positions, startComment, result: result || headers.Result || '*' };
}

// Comments are tidied for display: line breaks and runs of spaces become one space, and the
// [%clk 0:09:58]-style commands that chess sites add (clock times, arrows) are left out.
function addComment(before, comment) {
  const text = comment.replace(/\[%[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  return before && text ? `${before} ${text}` : before || text;
}
