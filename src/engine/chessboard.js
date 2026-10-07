import { inCheck } from './chess.js';
import { PIECE_SIZE, pieceSprite } from './chesspieces.js';
import { drawNumber } from './pixels.js';

// The pixel-art chessboard both chess dialogs draw: the game viewer (chessviewer.js) and the game against
// Stockfish (chessbattle.js). Drawn at its real size in game pixels; the dialogs scale it up by whole numbers.

export const SQUARE = PIECE_SIZE; // 16 px
export const FRAME = 6; // the wooden frame around the squares, with the coordinates in it
export const SIZE = SQUARE * 8 + FRAME * 2; // 140 px

export const COLORS = {
  light: '#f0d9b5',
  dark: '#b58863',
  frame: '#7a4a2a',
  frameLight: '#a06a40',
  frameDark: '#4e2e1a',
  label: '#f2e4c4',
  lastMove: 'rgba(250, 210, 60, 0.5)',
  check: 'rgba(225, 45, 35, 0.6)',
  selected: 'rgba(80, 160, 240, 0.55)',
  target: 'rgba(40, 60, 80, 0.45)',
};

// 3x5 letters for the files under the board (the rank numbers use drawNumber from pixels.js).
const FILE_LETTERS = {
  a: ['000', '011', '101', '101', '011'],
  b: ['100', '110', '101', '101', '110'],
  c: ['000', '011', '100', '100', '011'],
  d: ['001', '011', '101', '101', '011'],
  e: ['000', '011', '111', '100', '011'],
  f: ['001', '010', '111', '010', '010'],
  g: ['000', '011', '101', '011', '110'],
  h: ['100', '100', '110', '101', '101'],
};

/** Top-left corner of a square (0 = a1 ... 63 = h8) on the board picture. */
export function corner(square, flipped) {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  return [FRAME + (flipped ? 7 - file : file) * SQUARE, FRAME + (flipped ? rank : 7 - rank) * SQUARE];
}

/**
 * Draws a position: { position (from chess.js, or null for an empty board), flipped, lastMove, selected, targets,
 * sliding: { move, t } (a piece on its way, t from 0 to 1) }.
 */
export function drawBoard(ctx, { position = null, flipped = false, lastMove = null, selected = -1, targets = [], sliding = null }) {
  ctx.imageSmoothingEnabled = false;
  // The wooden frame, like the Chess House's table.
  ctx.fillStyle = COLORS.frame;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = COLORS.frameLight;
  ctx.fillRect(0, 0, SIZE, 1);
  ctx.fillRect(0, 0, 1, SIZE);
  ctx.fillStyle = COLORS.frameDark;
  ctx.fillRect(0, SIZE - 1, SIZE, 1);
  ctx.fillRect(SIZE - 1, 0, 1, SIZE);
  ctx.fillRect(FRAME - 1, FRAME - 1, SQUARE * 8 + 2, SQUARE * 8 + 2);
  for (let square = 0; square < 64; square++) {
    const [x, y] = corner(square, flipped);
    ctx.fillStyle = (square % 8) % 2 === Math.floor(square / 8) % 2 ? COLORS.dark : COLORS.light; // a1 is dark
    ctx.fillRect(x, y, SQUARE, SQUARE);
  }
  drawCoordinates(ctx, flipped);
  if (!position) return;

  const tint = (square, color) => {
    const [x, y] = corner(square, flipped);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, SQUARE, SQUARE);
  };
  if (lastMove) for (const square of [lastMove.from, lastMove.to]) tint(square, COLORS.lastMove);
  if (selected >= 0) tint(selected, COLORS.selected);
  if (inCheck(position)) tint(position.board.indexOf(position.turn === 'w' ? 'K' : 'k'), COLORS.check);
  position.board.forEach((piece, square) => {
    if (piece && !(sliding && square === sliding.move.to)) ctx.drawImage(pieceSprite(piece), ...corner(square, flipped));
  });
  // Where the selected piece can go: a dot on an empty square, corners on a piece it can take.
  ctx.fillStyle = COLORS.target;
  for (const square of targets) {
    const [x, y] = corner(square, flipped);
    if (position.board[square]) {
      for (const [cx, cy] of [[0, 0], [SQUARE - 3, 0], [0, SQUARE - 3], [SQUARE - 3, SQUARE - 3]]) ctx.fillRect(x + cx, y + cy, 3, 3);
    } else {
      ctx.fillRect(x + 6, y + 6, 4, 4);
    }
  }
  if (sliding) {
    const [x0, y0] = corner(sliding.move.from, flipped);
    const [x1, y1] = corner(sliding.move.to, flipped);
    const ease = 1 - (1 - sliding.t) * (1 - sliding.t);
    ctx.drawImage(pieceSprite(sliding.move.promotion || sliding.move.piece), Math.round(x0 + (x1 - x0) * ease), Math.round(y0 + (y1 - y0) * ease));
  }
}

function drawCoordinates(ctx, flipped) {
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  ctx.fillStyle = COLORS.label;
  [...files].forEach((letter, column) => {
    FILE_LETTERS[letter].forEach((bits, row) => {
      [...bits].forEach((bit, i) => bit === '1' && ctx.fillRect(FRAME + column * SQUARE + 6 + i, SIZE - FRAME + row, 1, 1));
    });
  });
  for (let row = 0; row < 8; row++) drawNumber(ctx, flipped ? row + 1 : 8 - row, 1, FRAME + row * SQUARE + 5, COLORS.label);
}
