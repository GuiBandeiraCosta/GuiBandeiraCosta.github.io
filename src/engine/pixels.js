// Helpers for drawing pixel art in code. Building and decoration sprites get a Painter.

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** Deterministic pseudo-random number for a position: the same input always gives the same output. */
export function hash(x, y, seed = 0) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A mirrored copy of a sprite (used for walking to the right, alternate steps, and so on). */
export function flipX(source) {
  const out = makeCanvas(source.width, source.height);
  const ctx = out.getContext('2d');
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return out;
}

/**
 * Turns rows of characters into a sprite. Each character is one pixel coloured with
 * palette[character]; "." and " " are transparent.
 */
export function fromRows(rows, palette) {
  const canvas = makeCanvas(Math.max(...rows.map((row) => row.length)), rows.length);
  new Painter(canvas).rows(0, 0, rows, palette);
  return canvas;
}

/** Drawing commands that always land on whole pixels. Every method returns the painter so calls can be chained. */
export class Painter {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }

  rect(x, y, w, h, color) {
    if (w > 0 && h > 0) {
      this.ctx.fillStyle = '#ff00ff'; // stays magenta if `color` is not a valid CSS colour, so a typo shows up
      this.ctx.fillStyle = color;
      this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
    return this;
  }

  px(x, y, color) {
    return this.rect(x, y, 1, 1, color);
  }

  hline(x, y, w, color) {
    return this.rect(x, y, w, 1, color);
  }

  vline(x, y, h, color) {
    return this.rect(x, y, 1, h, color);
  }

  /** 1-pixel rectangle outline. */
  box(x, y, w, h, color) {
    return this.hline(x, y, w, color).hline(x, y + h - 1, w, color).vline(x, y, h, color).vline(x + w - 1, y, h, color);
  }

  /** A grid of cols x rows cells alternating between colours a and b, like a chessboard. */
  checker(x, y, cols, rows, cellW, cellH, a, b) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) this.rect(x + c * cellW, y + r * cellH, cellW, cellH, (r + c) % 2 ? b : a);
    }
    return this;
  }

  /** Filled ellipse centred on (cx, cy). */
  ellipse(cx, cy, rx, ry, color) {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry || 1))));
      this.hline(cx - half, cy + dy, half * 2 + 1, color);
    }
    return this;
  }

  /**
   * A shape that is symmetric around a vertical axis, like a chess piece, vase or tower.
   * halfWidths lists, from the top row down, how far the shape reaches either side of cx.
   * shade(t, row) picks the colour: t runs from -1 (left edge) to 1 (right edge).
   */
  profile(cx, y, halfWidths, shade) {
    halfWidths.forEach((half, row) => {
      for (let x = cx - half; x < cx + half; x++) this.px(x, y + row, shade((x + 0.5 - cx) / half, row));
    });
    return this;
  }

  /** Stamps text-art rows (see fromRows) at (x, y). */
  rows(x, y, rows, palette) {
    for (const [ch, color] of Object.entries(palette)) {
      if (!CSS.supports('color', color)) console.warn(`Pixel art palette: "${ch}" is "${color}", which is not a colour (it shows as magenta)`);
    }
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch === '.' || ch === ' ') return;
        if (!(ch in palette)) console.warn(`Pixel art uses "${ch}" but the palette has no colour for it`);
        this.px(x + i, y + j, palette[ch] ?? '#ff00ff');
      });
    });
    return this;
  }

  image(source, x, y) {
    this.ctx.drawImage(source, Math.round(x), Math.round(y));
    return this;
  }

  /**
   * Draws a 1-pixel outline around everything drawn so far, in the empty pixels next to it.
   * Leave a 1-pixel empty margin around your art so the outline has room.
   */
  outline(color) {
    const { width: w, height: h } = this.canvas;
    const data = this.ctx.getImageData(0, 0, w, h).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0;
    this.ctx.fillStyle = color;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
          this.ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return this;
  }
}

// 3x5 digits for the coordinate grid (?grid in the address bar).
const DIGITS = [
  '111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111',
];

export function drawNumber(ctx, value, x, y, color) {
  ctx.fillStyle = color;
  [...String(value)].forEach((ch, i) => {
    if (ch === '-') {
      ctx.fillRect(x + i * 4, y + 2, 3, 1);
      return;
    }
    const bits = DIGITS[Number(ch)];
    for (let p = 0; p < 15; p++) if (bits[p] === '1') ctx.fillRect(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1);
  });
}
