import { TILE, ZOOM_TILES } from './constants.js';
import { makeCanvas } from './pixels.js';

/**
 * The game is drawn on a small canvas (the "view", in game pixels) and then copied to the
 * full-window canvas, scaled up by a whole number so every pixel stays a crisp square.
 */
export class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = makeCanvas(1, 1);
    this.viewCtx = this.view.getContext('2d');
    this.scale = 0;
    this.dpr = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    window.addEventListener('resize', () => this.resize());
    this.watchPixelRatio();
  }

  get width() {
    return this.view.width;
  }

  get height() {
    return this.view.height;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    const scale = Math.max(1, Math.floor(Math.min(w, h) / (ZOOM_TILES * TILE))); // device pixels per game pixel
    if (w === this.canvas.width && h === this.canvas.height && scale === this.scale && dpr === this.dpr) return;
    this.dpr = dpr;
    this.scale = scale;
    this.canvas.width = w;
    this.canvas.height = h;
    this.view.width = Math.ceil(w / scale);
    this.view.height = Math.ceil(h / scale);
    // The scaled view can be a few pixels larger than the window: crop it evenly on both sides.
    this.offsetX = Math.floor((w - this.view.width * scale) / 2);
    this.offsetY = Math.floor((h - this.view.height * scale) / 2);
    // Lets the CSS size the text box in game pixels too.
    document.documentElement.style.setProperty('--px', `${scale / dpr}px`);
    // The other HTML boxes (name plate, buttons, hint) use about 2 CSS pixels per font pixel,
    // rounded to whole device pixels so their letters stay even on 125% / 150% screens.
    document.documentElement.style.setProperty('--ui', `${Math.max(1, Math.round(2 * dpr)) / dpr}px`);
  }

  // Moving the window to a screen with a different pixel density doesn't always fire "resize".
  watchPixelRatio() {
    const query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener(
      'change',
      () => {
        this.resize();
        this.watchPixelRatio();
      },
      { once: true },
    );
  }

  present() {
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.view, this.offsetX, this.offsetY, this.view.width * this.scale, this.view.height * this.scale);
  }

  /** Converts a point in CSS pixels, relative to the canvas, into view pixels. */
  toView(cssX, cssY) {
    return [(cssX * this.dpr - this.offsetX) / this.scale, (cssY * this.dpr - this.offsetY) / this.scale];
  }
}
