import { Painter, fromRows } from './pixels.js';

// Pixel-art chess pieces for the game viewer. Each shape is drawn once as 16x16 text art and
// coloured twice, ivory for white and charcoal for black, like the giant pawn on the Chess House.
// A sprite covers a whole board square: draw it at the square's top-left corner.

export const PIECE_SIZE = 16;

// Letters: g glint, h highlight, w main colour, s shade, d deep shade, x carved detail (eye, slit).
// Light comes from the top left. The outline is added afterwards, so shapes keep a 1-pixel margin,
// and each piece stands on the same 10-pixel base at the bottom of its square.
const SHAPES = {
  p: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......hhws......',
    '.....hgwwsd.....',
    '.....hwwwsd.....',
    '......hwsd......',
    '....hhwwwssd....',
    '......dssd......',
    '.....hwwwsd.....',
    '....hhwwwssd....',
    '...hhwwwwwssd...',
    '................',
    '................',
  ],
  r: [
    '................',
    '................',
    '................',
    '................',
    '...gh..hw..sd...',
    '...hhwwwwwssd...',
    '....dddddddd....',
    '.....hwwwsd.....',
    '.....hwwwsd.....',
    '.....hwwwsd.....',
    '....hhwwwssd....',
    '....hhwwwssd....',
    '...hhwwwwwssd...',
    '...hwwwwwwssd...',
    '................',
    '................',
  ],
  n: [
    '................',
    '................',
    '........g.......',
    '.......hw.d.....',
    '......hwwwdd....',
    '.....hwxwwsdd...',
    '....hwwwwwsddd..',
    '...hwwwwwwssd...',
    '..hdwwwwwwssdd..',
    '..wsss..hwssd...',
    '...ss..hwwsddd..',
    '......hwwwssd...',
    '...hhwwwwwssd...',
    '...hwwwwwwssd...',
    '................',
    '................',
  ],
  b: [
    '................',
    '................',
    '.......gs.......',
    '................',
    '.......hw.......',
    '......hhwx......',
    '.....hhwxsd.....',
    '.....hwxwsd.....',
    '.....hwwwsd.....',
    '......hwsd......',
    '....hhwwwssd....',
    '......dssd......',
    '....hhwwwssd....',
    '...hhwwwwwssd...',
    '................',
    '................',
  ],
  q: [
    '................',
    '................',
    '...g...gs...d...',
    '....h.hwws.s....',
    '....hgwwwssd....',
    '.....hwwwsd.....',
    '......hwsd......',
    '....hhwwwssd....',
    '......dssd......',
    '......hwsd......',
    '.....hwwwsd.....',
    '....hhwwwssd....',
    '...hhwwwwwssd...',
    '...hwwwwwwssd...',
    '................',
    '................',
  ],
  k: [
    '................',
    '.......gh.......',
    '.......gh.......',
    '.....hggghh.....',
    '.......gh.......',
    '....hgwwwssd....',
    '....hhwwwssd....',
    '.....hwwwsd.....',
    '....hhwwwssd....',
    '......dssd......',
    '.....hwwwsd.....',
    '....hhwwwssd....',
    '...hhwwwwwssd...',
    '...hwwwwwwssd...',
    '................',
    '................',
  ],
};

// White can't get brighter than its highlight, so the glint only shows on black. On black the carved
// details are light instead of dark, so the knight's eye and the bishop's slit still show.
const PALETTES = {
  white: { outline: '#2e1a10', colors: { g: '#ffffff', h: '#ffffff', w: '#f2e8d2', s: '#d4c4a2', d: '#a8946e', x: '#2e1a10' } },
  black: { outline: '#120e18', colors: { g: '#8a84a0', h: '#5e5872', w: '#3a3446', s: '#2c2738', d: '#201b29', x: '#8a84a0' } },
};

const cache = new Map();

/** The 16x16 sprite for a piece: 'PNBRQK' are white, 'pnbrqk' are black. Each is drawn once, then reused. */
export function pieceSprite(code) {
  let sprite = cache.get(code);
  if (!sprite) {
    if (!/^[pnbrqk]$/i.test(code)) throw new Error(`Unknown chess piece "${code}" (use PNBRQK for white, pnbrqk for black)`);
    const { outline, colors } = code === code.toUpperCase() ? PALETTES.white : PALETTES.black;
    sprite = fromRows(SHAPES[code.toLowerCase()], colors);
    new Painter(sprite).outline(outline);
    cache.set(code, sprite);
  }
  return sprite;
}
