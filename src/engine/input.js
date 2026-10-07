const KEYS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyZ: 'a',
  Enter: 'a',
  NumpadEnter: 'a',
  Space: 'a',
  KeyX: 'b',
  Escape: 'b',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};
// By key name, for keys whose position isn't listed above: numpad arrows (NumLock off), and Z / X on
// keyboards where they sit elsewhere (e.g. German QWERTZ).
const KEY_NAMES = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'a', Z: 'a', x: 'b', X: 'b' };
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

/**
 * Collects keyboard, touch and mouse input into one simple state the game reads every tick:
 * the direction being held (the most recent one wins), A/B presses, and taps on the map.
 */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.dirHolds = new Map(); // hold id -> direction, oldest first
    this.buttonHolds = { a: new Set(), b: new Set(), run: new Set() };
    this.pressed = { a: false, b: false, dir: null }; // dir: a direction pressed this tick (for menus)
    this.taps = [];
    this.lastDevice = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => document.hidden && this.releaseAll());
    this.bindTaps(canvas);
  }

  /** The direction the player wants to walk in, or null. */
  get dir() {
    let dir = null;
    for (const d of this.dirHolds.values()) dir = d;
    return dir;
  }

  get run() {
    return this.buttonHolds.run.size > 0 || this.buttonHolds.b.size > 0;
  }

  /** True once per press of A or B; reading it uses it up. */
  consume(button) {
    const was = this.pressed[button];
    this.pressed[button] = false;
    return was;
  }

  press(button) {
    this.pressed[button] = true;
  }

  hold(id, action) {
    if (DIRECTIONS.has(action)) {
      if (this.dirHolds.get(id) !== action) this.pressed.dir = action;
      this.dirHolds.delete(id);
      this.dirHolds.set(id, action);
      return;
    }
    const holds = this.buttonHolds[action];
    if (!holds.has(id)) {
      holds.add(id);
      if (action in this.pressed) this.pressed[action] = true;
    }
  }

  release(id) {
    this.dirHolds.delete(id);
    for (const holds of Object.values(this.buttonHolds)) holds.delete(id);
  }

  /** Lets go of the held directions: a key still held then does nothing until it is pressed again. */
  releaseDirections() {
    this.dirHolds.clear();
  }

  releaseAll() {
    this.dirHolds.clear();
    for (const holds of Object.values(this.buttonHolds)) holds.clear();
  }

  /** Called by the game at the end of every tick. */
  endTick() {
    this.pressed.a = false;
    this.pressed.b = false;
    this.pressed.dir = null;
    this.taps.length = 0;
  }

  // Game keys only work while the page itself (or the game canvas) has focus, so they never
  // interfere with links, buttons or the text-version dialog.
  acceptsKeys() {
    const active = document.activeElement;
    return !active || active === document.body || active === this.canvas;
  }

  onKey(e, down) {
    // macOS sends no keyup for a key released while Cmd is down, so let go of everything when Cmd is released.
    if (!down && e.key === 'Meta') this.releaseAll();
    const action = KEYS[e.code] ?? KEY_NAMES[e.key];
    if (!action) return;
    const id = `key:${e.code || e.key}`;
    if (!down) {
      this.release(id);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || !this.acceptsKeys()) return;
    e.preventDefault(); // stop arrow keys and space from scrolling the page
    this.lastDevice = 'keyboard';
    if (!e.repeat) this.hold(id, action);
  }

  bindTaps(canvas) {
    let start = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!start || start.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      start = null;
      if (moved > 16) return;
      const rect = canvas.getBoundingClientRect();
      this.taps.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      this.lastDevice = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    });
    canvas.addEventListener('pointercancel', () => (start = null));
    // A press released over something else (a button, the text box) is not a tap on the map.
    window.addEventListener('pointerup', (e) => e.target !== canvas && (start = null));
  }

  /** On-screen D-pad: press and slide a finger over it; the direction follows the finger. */
  bindDpad(pad) {
    const id = (e) => `pad:${e.pointerId}`;
    const update = (e) => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.12) {
        this.release(id(e));
        pad.dataset.dir = '';
        return;
      }
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (this.dirHolds.get(id(e)) !== dir) this.hold(id(e), dir);
      pad.dataset.dir = dir;
    };
    pad.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      this.lastDevice = 'touch';
      update(e);
    });
    pad.addEventListener('pointermove', (e) => pad.hasPointerCapture(e.pointerId) && update(e));
    const end = (e) => {
      this.release(id(e));
      pad.dataset.dir = '';
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('lostpointercapture', end);
  }

  /** On-screen A or B button. Holding B also makes the player run. */
  bindButton(button, action) {
    const id = (e) => `btn:${action}:${e.pointerId}`;
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      this.lastDevice = 'touch';
      this.hold(id(e), action);
      button.classList.add('is-pressed');
    });
    const end = (e) => {
      this.release(id(e));
      button.classList.remove('is-pressed');
    };
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
  }
}
