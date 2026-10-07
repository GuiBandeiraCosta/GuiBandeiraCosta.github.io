import { parsePgn } from './chess.js';
import { SIZE, drawBoard } from './chessboard.js';
import { closeOnBackdropClick } from './page.js';

// The chess game viewer: a pixel-art board to replay a game move by move, with the list of moves.
// It is an HTML <dialog>, so it works with the keyboard, the mouse and touch, and screen readers can follow it.
// A building uses it through a decoration with `game: { pgn, orientation, title, ask }` (see README.md).

const PLAY_MS = 1100; // time per move when playing
const SLIDE_MS = 140; // how long a piece takes to slide to its new square
const RESULTS = { '1-0': 'White won', '0-1': 'Black won', '1/2-1/2': 'Draw' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Pixel icons for the buttons (7 x 7 grid): arrows step through the moves, the triangle plays them.
const ICONS = {
  first: 'M0 0h1v7H0zM5 0h2v1H5zM4 1h2v1H4zM3 2h2v1H3zM2 3h2v1H2zM3 4h2v1H3zM4 5h2v1H4zM5 6h2v1H5z',
  prev: 'M4 0h2v1H4zM3 1h2v1H3zM2 2h2v1H2zM1 3h2v1H1zM2 4h2v1H2zM3 5h2v1H3zM4 6h2v1H4z',
  play: 'M2 0h1v7H2zM3 1h1v5H3zM4 2h1v3H4zM5 3h1v1H5z',
  pause: 'M1 0h2v7H1zM4 0h2v7H4z',
  next: 'M1 0h2v1H1zM2 1h2v1H2zM3 2h2v1H3zM4 3h2v1H4zM3 4h2v1H3zM2 5h2v1H2zM1 6h2v1H1z',
  last: 'M6 0h1v7H6zM0 0h2v1H0zM1 1h2v1H1zM2 2h2v1H2zM3 3h2v1H3zM2 4h2v1H2zM1 5h2v1H1zM0 6h2v1H0z',
  flip: 'M1 0h1v7H1zM0 1h1v1H0zM2 1h1v1H2zM5 0h1v7H5zM4 5h1v1H4zM6 5h1v1H6z',
  close: 'M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h1v1H2zM4 2h1v1H4zM3 3h1v1H3zM2 4h1v1H2zM4 4h1v1H4zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z',
};
const icon = (name) => `<svg viewBox="0 0 7 7" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

const parsed = new Map(); // each PGN is read only once

export class ChessViewer {
  constructor(onClose) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'sheet viewer';
    this.dialog.setAttribute('aria-labelledby', 'viewer-title');
    // Laid out by CSS (.viewer__layout): on big screens the heading spans the top and the board sits beside
    // the side column; on short screens the heading moves beside the board; on narrow screens it is one column.
    // The order here is also the Tab order, so the buttons come before the long list of moves.
    this.dialog.innerHTML = `
      <div class="viewer__layout">
        <div class="viewer__head">
          <h2 id="viewer-title" tabindex="-1" autofocus></h2>
          <form method="dialog" class="viewer__close"><button class="plate" aria-label="Back to the room">${icon('close')}</button></form>
          <p class="viewer__players"></p>
          <p class="viewer__meta"></p>
        </div>
        <canvas class="viewer__board" width="${SIZE}" height="${SIZE}" aria-hidden="true"></canvas>
        <div class="viewer__side">
          <p class="viewer__status" aria-live="polite"></p>
          <p class="viewer__comment" aria-live="polite"></p>
          <div class="viewer__controls">
            <button type="button" class="plate" data-go="first" aria-label="First move">${icon('first')}</button>
            <button type="button" class="plate" data-go="prev" aria-label="Previous move">${icon('prev')}</button>
            <button type="button" class="plate viewer__play" data-go="play" aria-label="Play">${icon('play')}</button>
            <button type="button" class="plate" data-go="next" aria-label="Next move">${icon('next')}</button>
            <button type="button" class="plate" data-go="last" aria-label="Last move">${icon('last')}</button>
            <button type="button" class="plate" data-go="flip" aria-label="Flip the board">${icon('flip')}</button>
          </div>
          <p class="viewer__moves"></p>
          <p class="viewer__keys">Keyboard: Left / Right arrows</p>
          <div class="viewer__foot">
            <a class="viewer__link" target="_blank" rel="noopener"></a>
            <form method="dialog"><button class="plate">Back to the room</button></form>
          </div>
        </div>
      </div>`;
    document.body.append(this.dialog);
    const $ = (selector) => this.dialog.querySelector(selector);
    this.el = {
      layout: $('.viewer__layout'),
      head: $('.viewer__head'),
      title: $('h2'),
      players: $('.viewer__players'),
      meta: $('.viewer__meta'),
      status: $('.viewer__status'),
      comment: $('.viewer__comment'),
      controls: $('.viewer__controls'),
      moves: $('.viewer__moves'),
      link: $('.viewer__link'),
      play: $('.viewer__play'),
    };
    this.canvas = $('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.ply = 0;
    this.slideToken = 0;
    this.timer = null;

    this.el.controls.addEventListener('click', (e) => {
      const action = e.target.closest('button')?.dataset.go;
      if (action === 'play') this.togglePlay();
      else if (action === 'flip') this.flip();
      else if (action) this.step(action);
    });
    this.el.moves.addEventListener('click', (e) => {
      const ply = Number(e.target.closest('button')?.dataset.ply);
      if (!ply) return;
      this.stop();
      this.go(ply, { animate: ply === this.ply + 1 });
    });
    this.dialog.addEventListener('keydown', (e) => {
      const keys = { ArrowLeft: 'prev', ArrowRight: 'next', Home: 'first', End: 'last' };
      if (!keys[e.key] || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      this.step(keys[e.key]);
    });
    closeOnBackdropClick(this.dialog);
    this.dialog.addEventListener('close', () => {
      this.stop();
      onClose?.();
    });
    window.addEventListener('resize', () => this.dialog.open && this.fit());
  }

  /** Opens the viewer on a game: { pgn, orientation: 'white' | 'black', title, link }. */
  open(game) {
    this.stop();
    try {
      if (!parsed.has(game.pgn)) parsed.set(game.pgn, parsePgn(game.pgn));
      this.game = parsed.get(game.pgn);
      this.error = null;
    } catch (err) {
      console.error(`[chess] The game could not be read: ${err.message}`);
      this.game = null;
      this.error = err.message;
    }
    this.flipped = game.orientation === 'black';
    this.fillHeader(game);
    this.fillMoves();
    this.dialog.querySelectorAll('.viewer__controls button').forEach((button) => (button.disabled = !this.game));
    if (!this.dialog.open) this.dialog.showModal();
    this.ply = 0;
    this.go(0); // after showModal: a hidden move list can't scroll back to the top
    this.fit(); // after showModal too: it measures the dialog
  }

  fillHeader(game) {
    const tags = this.game?.headers ?? {};
    const player = (color) => {
      const name = tags[color] && tags[color] !== '?' ? tags[color] : color;
      const elo = tags[`${color}Elo`] ? ` (${tags[`${color}Elo`]})` : '';
      const swatch = document.createElement('span');
      swatch.className = `viewer__swatch viewer__swatch--${color.toLowerCase()}`;
      const label = document.createElement('span');
      label.textContent = `${name}${elo}`;
      return [swatch, label];
    };
    this.el.title.textContent = game.title ?? (this.game ? `${tags.White ?? 'White'} vs ${tags.Black ?? 'Black'}` : 'Chess game');
    this.el.players.replaceChildren(...player('White'), ' vs ', ...player('Black'));
    const round = tags.Round && tags.Round !== '?' && tags.Round !== '-' ? `Round ${tags.Round}` : '';
    this.el.meta.textContent = [tags.Event, tags.Site, round, prettyDate(tags.Date), tags.TimeControl, RESULTS[this.game?.result]]
      .filter((part) => part && part !== '?')
      .join(' · ');
    const link = game.link ?? tags.Link;
    this.el.link.hidden = !link;
    if (link) {
      this.el.link.href = link;
      this.el.link.textContent = link.includes('chess.com') ? 'Open on chess.com' : 'Open the game online';
    }
  }

  // The moves as text, PGN style ("1. e4 e5 2. Nf3 ..."); each move is a button that jumps there.
  fillMoves() {
    this.buttons = [];
    if (!this.game) {
      this.el.moves.replaceChildren();
      return;
    }
    // Each full move ("4. d3 Bc5") is kept together on one line.
    const pairs = [];
    let pair = null;
    this.game.moves.forEach((move, i) => {
      if (move.color === 'w' || !pair) {
        pair = document.createElement('span');
        pair.className = 'viewer__pair';
        const number = document.createElement('span');
        number.className = 'viewer__number';
        number.textContent = move.color === 'w' ? `${move.number}.` : `${move.number}...`;
        number.setAttribute('aria-hidden', 'true'); // each button says its own number (below)
        pair.append(number);
        pairs.push(pair, ' ');
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.ply = i + 1;
      button.textContent = move.san;
      button.setAttribute('aria-label', `${moveName(move)}${move.comment ? ', with a comment' : ''}`);
      if (move.comment) button.classList.add('has-comment');
      this.buttons.push(button);
      pair.append(button);
    });
    if (RESULTS[this.game.result]) {
      // Kept on one line like a move, so '1-0' never breaks at its hyphen.
      const result = document.createElement('span');
      result.className = 'viewer__pair';
      result.textContent = this.game.result;
      pairs.push(result);
    }
    this.el.moves.replaceChildren(...pairs);
  }

  step(action) {
    if (!this.game) return;
    this.stop();
    const target = { first: 0, prev: this.ply - 1, next: this.ply + 1, last: this.game.moves.length }[action];
    this.go(target, { animate: action === 'next' });
  }

  go(ply, { animate = false } = {}) {
    const total = this.game?.moves.length ?? 0;
    const forwardOne = animate && ply === this.ply + 1 && !this.reducedMotion.matches;
    this.ply = Math.min(Math.max(ply, 0), total);
    this.slideToken++;
    this.describe();
    if (forwardOne && this.ply === ply) this.slide();
    else this.draw();
  }

  // The status line ("8... Rxe5"), the comment for that move, and the highlight in the move list.
  describe() {
    if (!this.game) {
      this.el.status.textContent = 'Sorry, this game could not be read.';
      this.el.comment.textContent = this.error ?? '';
      return;
    }
    const move = this.game.moves[this.ply - 1];
    const end = this.ply === this.game.moves.length && RESULTS[this.game.result] ? ` · ${RESULTS[this.game.result]}` : '';
    this.el.status.textContent = move ? `${moveName(move)}${end}` : 'Start position';
    this.el.comment.textContent = move ? move.comment : this.game.startComment;
    this.buttons.forEach((button, i) => {
      const current = i === this.ply - 1;
      button.classList.toggle('is-current', current);
      if (current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    this.showCurrentMove();
  }

  // Keeps the current move visible by scrolling the move list only (never the whole dialog).
  showCurrentMove() {
    const button = this.buttons[this.ply - 1];
    const list = this.el.moves;
    if (!button) list.scrollTop = 0; // the start position: back to the first moves
    else if (button.offsetTop < list.scrollTop) list.scrollTop = button.offsetTop;
    else if (button.offsetTop + button.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = button.offsetTop + button.offsetHeight - list.clientHeight;
    }
  }

  togglePlay() {
    if (this.timer) {
      this.stop();
      return;
    }
    if (this.ply >= this.game.moves.length) this.go(0);
    this.showPlaying(true);
    this.timer = setInterval(() => {
      this.go(this.ply + 1, { animate: true });
      if (this.ply >= this.game.moves.length) this.stop(); // the last move is on the board: back to 'Play' at once
    }, PLAY_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.showPlaying(false);
  }

  showPlaying(playing) {
    this.el.play.innerHTML = icon(playing ? 'pause' : 'play');
    this.el.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  flip() {
    this.flipped = !this.flipped;
    this.draw();
  }

  // Slides the piece that just moved from its old square to its new one.
  slide() {
    const token = this.slideToken;
    const move = this.game.moves[this.ply - 1];
    const start = performance.now();
    const frame = (now) => {
      if (token !== this.slideToken) return; // someone moved on in the meantime
      const t = Math.min(1, (now - start) / SLIDE_MS);
      this.draw(t < 1 ? { move, t } : null);
      if (t < 1) requestAnimationFrame(frame);
    };
    frame(start);
  }

  draw(sliding = null) {
    const position = this.game?.positions[this.ply] ?? null;
    drawBoard(this.ctx, { position, flipped: this.flipped, lastMove: this.game?.moves[this.ply - 1] ?? null, sliding });
  }

  // The board is drawn at its real pixel size and scaled up by a whole number, like the rest of the game,
  // as big as fits. These match the media queries for .viewer__layout in style.css.
  fit() {
    const dpr = window.devicePixelRatio || 1;
    const px = (value) => parseFloat(value) || 0;
    const style = getComputedStyle(this.dialog);
    const gap = px(getComputedStyle(this.el.layout).rowGap);
    // The space inside the dialog's frame and padding. Its height is at most 94% of the window (.viewer in style.css).
    const width = this.dialog.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
    const height = window.innerHeight * 0.94 - px(style.borderTopWidth) - px(style.borderBottomWidth) - px(style.paddingTop) - px(style.paddingBottom);
    const short = matchMedia('(min-width: 760px) and (max-height: 599px)').matches;
    let room;
    if (matchMedia('(min-width: 760px) and (min-height: 600px)').matches) {
      room = Math.min(width * 0.58, height - this.el.head.offsetHeight - gap); // the heading above the board
    } else if (short) {
      room = Math.min(width * 0.5, height); // the heading beside the board
    } else {
      // One column: the heading, the board, then the buttons, the move and two lines of its comment, all on screen.
      const title = this.el.title.offsetHeight + px(getComputedStyle(this.el.title).marginBottom);
      const comment = 2 * px(getComputedStyle(this.el.comment).lineHeight);
      room = Math.min(width, height - title - this.el.controls.offsetHeight - this.el.status.offsetHeight - comment - 4 * gap);
    }
    const scale = Math.max(1, Math.floor((room * dpr) / SIZE));
    const size = (SIZE * scale) / dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.dialog.style.setProperty('--board-size', `${size}px`); // the side column is at least as tall as the board
    // Phones on their side: a move list with no room for one whole line is left out (the status names the move).
    this.el.moves.hidden = false;
    if (short) this.el.moves.hidden = this.el.moves.clientHeight < px(getComputedStyle(this.el.moves).lineHeight);
    this.showCurrentMove();
  }
}

// A move as it is written in the move list: '8... Rxe5' (Black) or '9. dxe5' (White).
function moveName(move) {
  return `${move.number}${move.color === 'w' ? '.' : '...'} ${move.san}`;
}

// '2019.05.09' -> '9 May 2019' (PGN dates can have '??' for unknown parts).
function prettyDate(date) {
  const [year, month, day] = (date ?? '').split('.');
  if (!/^\d{4}$/.test(year ?? '')) return '';
  if (!/^\d\d$/.test(month ?? '')) return year;
  if (!/^\d\d$/.test(day ?? '')) return `${MONTHS[Number(month) - 1]} ${year}`;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}
