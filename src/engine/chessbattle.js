import { START_FEN, inCheck, legalMoves, makeMove, parseFen, squareIndex, squareName, toFen, toSan } from './chess.js';
import { SIZE, drawBoard } from './chessboard.js';
import { closeOnBackdropClick } from './page.js';

// A game of chess against Stockfish, the Chess House's boss battle. It is an HTML <dialog> like the game viewer
// (and shares its layout): the board is a picture with a grid of 64 buttons over it, so a piece can be moved with a
// tap, a click or the keyboard (arrows, then Enter on the piece and Enter on its square), and screen readers hear
// every move. The rules come from chess.js; Stockfish only chooses its own moves.
//
// Stockfish runs in a web worker from vendor/stockfish/ (its lite, single-threaded WebAssembly build: 1.8 MB, and it
// needs no special server headers, so it works on GitHub Pages). It is only downloaded when someone accepts the
// battle. UCI_LimitStrength and UCI_Elo make it play at about the asked rating.
// A room opens it with ctx.show('battle', { elo, color, title, players, resume, onClose }) (see README.md).

const ENGINE_URL = new URL('../../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url);
const MOVE_MS = 1000; // how long Stockfish thinks about each move
const SLIDE_MS = 140; // how long a piece takes to slide to its new square
const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

// Pixel icons (7 x 7 grid), as in the game viewer.
const ICONS = {
  flip: 'M1 0h1v7H1zM0 1h1v1H0zM2 1h1v1H2zM5 0h1v7H5zM4 5h1v1H4zM6 5h1v1H6z',
  close: 'M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h1v1H2zM4 2h1v1H4zM3 3h1v1H3zM2 4h1v1H2zM4 4h1v1H4zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z',
};
const icon = (name) => `<svg viewBox="0 0 7 7" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

/** Talks to Stockfish in its worker: one question at a time, each answered by a line that starts with a known word. */
class Engine {
  constructor(elo) {
    this.waiting = null; // { prefix, resolve, reject }
    this.queue = Promise.resolve();
    this.broken = null;
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (e) => {
      const line = String(e.data);
      if (this.waiting && line.startsWith(this.waiting.prefix)) this.waiting.resolve(line);
    };
    this.worker.onerror = (e) => {
      e.preventDefault();
      this.broken = new Error(`Stockfish could not start (${e.message || 'the download failed'})`);
      this.waiting?.reject(this.broken);
    };
    this.ready = this.start(elo);
    this.ready.catch(() => {}); // reported by the first move that needs it
  }

  expect(prefix, ms) {
    if (this.broken) return Promise.reject(this.broken);
    return new Promise((resolve, reject) => {
      const done = (fn) => (value) => {
        clearTimeout(timer);
        this.waiting = null;
        fn(value);
      };
      const timer = setTimeout(() => this.waiting?.reject(new Error(`Stockfish did not answer "${prefix}" in time`)), ms);
      this.waiting = { prefix, resolve: done(resolve), reject: done(reject) };
    });
  }

  async ask(command, prefix, ms = 20000) {
    const answer = this.expect(prefix, ms);
    this.worker.postMessage(command);
    return answer;
  }

  async start(elo) {
    await this.ask('uci', 'uciok');
    this.worker.postMessage('setoption name UCI_LimitStrength value true');
    this.worker.postMessage(`setoption name UCI_Elo value ${elo}`);
    await this.ask('isready', 'readyok');
  }

  /** Stockfish's move in a position, in UCI form ('e7e5', 'a2a1q'). Searches run one after another. */
  bestMove(fen) {
    const search = this.queue.then(async () => {
      await this.ready;
      this.worker.postMessage(`position fen ${fen}`);
      const line = await this.ask(`go movetime ${MOVE_MS}`, 'bestmove', MOVE_MS + 20000);
      return line.split(/\s+/)[1];
    });
    this.queue = search.catch(() => {});
    return search;
  }

  newGame() {
    this.queue = this.queue
      .then(async () => {
        await this.ready;
        this.worker.postMessage('ucinewgame');
        await this.ask('isready', 'readyok');
      })
      .catch(() => {});
  }
}

export class ChessBattle {
  constructor(onClose) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'sheet viewer battle';
    this.dialog.setAttribute('aria-labelledby', 'battle-title');
    // The same layout as the game viewer (.viewer__layout in style.css). The DOM order is the Tab order.
    this.dialog.innerHTML = `
      <div class="viewer__layout">
        <div class="viewer__head">
          <h2 id="battle-title" tabindex="-1" autofocus></h2>
          <form method="dialog" class="viewer__close"><button class="plate" aria-label="Back to the room">${icon('close')}</button></form>
          <p class="viewer__players"></p>
        </div>
        <div class="viewer__board battle__board">
          <canvas width="${SIZE}" height="${SIZE}" aria-hidden="true"></canvas>
          <div class="battle__squares" role="group" aria-label="The chessboard"></div>
        </div>
        <div class="viewer__side">
          <p class="viewer__status" aria-live="polite"></p>
          <div class="battle__promote" role="group" aria-label="Promote your pawn to" hidden>
            <span>Promote to:</span>
            <button type="button" class="plate" data-promote="q">Queen</button>
            <button type="button" class="plate" data-promote="r">Rook</button>
            <button type="button" class="plate" data-promote="b">Bishop</button>
            <button type="button" class="plate" data-promote="n">Knight</button>
          </div>
          <div class="viewer__controls">
            <button type="button" class="plate" data-do="resign">Resign</button>
            <button type="button" class="plate" data-do="new">New game</button>
            <button type="button" class="plate" data-do="flip" aria-label="Flip the board">${icon('flip')}</button>
          </div>
          <p class="viewer__moves battle__moves" aria-label="Moves"></p>
          <p class="viewer__keys">Keyboard: arrows to look around the board, Enter to pick a piece, then Enter on its square</p>
          <div class="viewer__foot">
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
      board: $('.battle__board'),
      squares: $('.battle__squares'),
      status: $('.viewer__status'),
      promote: $('.battle__promote'),
      controls: $('.viewer__controls'),
      resign: $('[data-do="resign"]'),
      moves: $('.battle__moves'),
    };
    this.canvas = $('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.focusIndex = 52; // the square the keyboard starts on (e2 for White)
    this.slideToken = 0;
    this.token = 0; // a new game makes any answer Stockfish is still working on out of date

    // The 64 buttons, in the order they appear on screen (top-left first). Which square each one is depends on
    // which way the board faces, so render() sets that.
    this.buttons = Array.from({ length: 64 }, (_, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = i === this.focusIndex ? 0 : -1;
      button.addEventListener('click', () => this.pick(Number(button.dataset.square)));
      button.addEventListener('focus', () => this.roveTo(i));
      this.el.squares.append(button);
      return button;
    });
    this.el.squares.addEventListener('keydown', (e) => {
      const steps = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
      if (!(e.key in steps) || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const i = this.focusIndex;
      const next = i + steps[e.key];
      const sameRow = Math.floor(next / 8) === Math.floor(i / 8);
      if (next < 0 || next > 63 || ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !sameRow)) return;
      this.buttons[next].focus();
    });
    this.el.controls.addEventListener('click', (e) => {
      const action = e.target.closest('button')?.dataset.do;
      if (action === 'flip') {
        this.flipped = !this.flipped;
        this.render();
      } else if (action === 'resign') this.resign();
      else if (action === 'new') this.newGame(this.color);
    });
    this.el.promote.addEventListener('click', (e) => {
      const piece = e.target.closest('button')?.dataset.promote;
      if (piece) this.promote(piece);
    });
    closeOnBackdropClick(this.dialog);
    this.dialog.addEventListener('close', () => {
      this.slideToken++;
      onClose?.();
      this.options?.onClose?.(this.room, this.result ?? (this.sans.length ? 'unfinished' : 'unstarted'));
    });
    window.addEventListener('resize', () => this.dialog.open && this.fit());
  }

  /**
   * Opens the board: { elo (2000), color ('w' or 'b': the visitor's pieces), title, players, resume, onClose(ctx, result) }.
   * With `resume`, an unfinished game carries on. The result is 'won', 'lost', 'draw', 'resigned', 'unfinished' or 'unstarted'.
   */
  open(options, ctx) {
    this.options = options;
    this.room = ctx; // the room's ctx, handed back to onClose
    const elo = options.elo ?? 2000;
    this.el.title.textContent = options.title ?? `Stockfish, about ${elo}`;
    try {
      this.engine ??= new Engine(elo);
    } catch (err) {
      console.error(err);
      this.engine = null;
    }
    const carryOn = options.resume && this.position && !this.result;
    if (!carryOn) this.newGame(options.color ?? 'w', { quiet: true });
    if (!this.dialog.open) this.dialog.showModal();
    this.fit();
    if (!this.engine) this.say('Sorry, Stockfish could not be loaded. Please reload the page to try again.');
    else if (carryOn) this.say(this.position.turn === this.color ? 'Welcome back! Your move.' : 'Welcome back!');
    if (this.position.turn !== this.color && !this.thinking) this.engineMove();
  }

  newGame(color, { quiet = false } = {}) {
    this.token++;
    this.color = color;
    this.flipped = color === 'b';
    this.position = parseFen(START_FEN);
    this.seen = [positionKey(this.position)];
    this.sans = [];
    this.lastMove = null;
    this.selected = -1;
    this.result = null;
    this.thinking = false;
    this.pendingPromotion = null;
    this.el.promote.hidden = true;
    this.engine?.newGame();
    const you = color === 'w' ? 'White' : 'Black';
    this.el.players.textContent = this.options?.players ?? `You play ${you}. Stockfish plays ${color === 'w' ? 'Black' : 'White'}.`;
    this.focusIndex = color === 'w' ? 52 : 11; // your king's pawn
    this.render();
    this.say(color === 'w' ? 'A new game. You play White: your move!' : 'A new game. You play Black: Stockfish moves first.');
    if (!quiet && this.position.turn !== color) this.engineMove();
  }

  // ---------------------------------------------------------------- your moves

  /** A tap, click or Enter on a square: pick one of your pieces, or move the picked piece there. */
  pick(square) {
    if (this.result || this.thinking || this.position.turn !== this.color || this.pendingPromotion) return;
    const moves = this.selected >= 0 ? legalMoves(this.position).filter((m) => m.from === this.selected && m.to === square) : [];
    if (moves.length > 1) {
      // A pawn reaching the last rank: the four versions differ only in the new piece.
      this.pendingPromotion = moves;
      this.el.promote.hidden = false;
      this.el.promote.querySelector('button').focus();
      this.say('Choose a piece for your pawn.');
      return;
    }
    if (moves.length === 1) {
      this.play(moves[0]);
      return;
    }
    const piece = this.position.board[square];
    const mine = piece && (piece === piece.toUpperCase() ? 'w' : 'b') === this.color;
    const canMove = mine && legalMoves(this.position).some((m) => m.from === square);
    this.selected = canMove && this.selected !== square ? square : -1;
    if (mine && !canMove) this.say(`Your ${PIECE_NAMES[piece.toLowerCase()]} on ${squareName(square)} has no legal moves.`);
    this.render();
  }

  promote(type) {
    const move = this.pendingPromotion?.find((m) => m.promotion.toLowerCase() === type);
    this.pendingPromotion = null;
    this.el.promote.hidden = true;
    this.buttons[this.focusIndex].focus();
    if (move) this.play(move);
  }

  resign() {
    if (this.result || !this.position) return;
    this.token++;
    this.thinking = false;
    this.result = 'resigned';
    this.selected = -1;
    this.render();
    this.say('You resigned. Stockfish wins this one.');
  }

  // ---------------------------------------------------------------- Stockfish's moves

  async engineMove() {
    if (!this.engine || this.result) return;
    const token = this.token;
    const fen = toFen(this.position);
    this.thinking = true;
    this.render();
    try {
      const uci = await this.engine.bestMove(fen);
      // A new game started (or you resigned) while it was thinking: its answer is for a game that is over.
      if (token !== this.token || toFen(this.position) !== fen) return;
      const move = this.fromUci(uci);
      if (!move) throw new Error(`Stockfish answered "${uci}", which is not a legal move here`);
      this.thinking = false;
      this.play(move);
    } catch (err) {
      if (token !== this.token) return;
      console.error(`[chess] ${err.message}`);
      this.thinking = false;
      this.say('Sorry, Stockfish could not be loaded. Please reload the page to try again.');
    }
  }

  fromUci(uci) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci ?? '')) return null;
    const [from, to, promotion] = [squareIndex(uci.slice(0, 2)), squareIndex(uci.slice(2, 4)), uci[4] ?? ''];
    return legalMoves(this.position).find((m) => m.from === from && m.to === to && m.promotion.toLowerCase() === promotion) ?? null;
  }

  // ---------------------------------------------------------------- both sides

  play(move) {
    const mover = this.position.turn === this.color ? 'You' : 'Stockfish';
    const san = toSan(this.position, move);
    const number = this.position.fullmove;
    this.sans.push(this.position.turn === 'w' ? `${number}. ${san}` : this.sans.length ? san : `${number}... ${san}`);
    this.position = makeMove(this.position, move);
    this.seen.push(positionKey(this.position));
    this.lastMove = move;
    this.selected = -1;
    const end = this.outcome();
    this.result = end?.result ?? null;
    this.render();
    this.slide(move);
    const played = `${mover} played ${san}.`;
    if (end) this.say(`${played} ${end.text}`);
    else if (this.position.turn === this.color) this.say(`${played} ${inCheck(this.position) ? 'Check! ' : ''}Your move.`);
    else {
      this.say(`${played} Stockfish is thinking...`);
      this.engineMove();
    }
  }

  /** How the game ended, if it did: { result, text }. */
  outcome() {
    const position = this.position;
    const youWin = position.turn !== this.color;
    if (legalMoves(position).length === 0) {
      if (inCheck(position)) return youWin ? { result: 'won', text: 'Checkmate! You win!' } : { result: 'lost', text: 'Checkmate. Stockfish wins.' };
      return { result: 'draw', text: 'Stalemate: the game is a draw.' };
    }
    if (this.seen.filter((key) => key === this.seen[this.seen.length - 1]).length >= 3) return { result: 'draw', text: 'The same position came up three times: a draw.' };
    if (position.halfmove >= 100) return { result: 'draw', text: 'Fifty moves with no capture and no pawn move: a draw.' };
    const others = position.board.filter((piece) => piece && piece.toLowerCase() !== 'k');
    if (others.length === 0 || (others.length === 1 && 'nb'.includes(others[0].toLowerCase()))) {
      return { result: 'draw', text: 'Neither side can checkmate any more: a draw.' };
    }
    return null;
  }

  // ---------------------------------------------------------------- showing it

  say(text) {
    this.el.status.textContent = text;
  }

  render(sliding = null) {
    const targets = this.selected >= 0 ? legalMoves(this.position).filter((m) => m.from === this.selected).map((m) => m.to) : [];
    drawBoard(this.ctx, { position: this.position, flipped: this.flipped, lastMove: this.lastMove, selected: this.selected, targets, sliding });
    if (sliding) return;
    this.buttons.forEach((button, i) => {
      const row = Math.floor(i / 8);
      const column = i % 8;
      const square = this.flipped ? row * 8 + (7 - column) : (7 - row) * 8 + column;
      const piece = this.position.board[square];
      const what = piece ? `${piece === piece.toUpperCase() ? 'white' : 'black'} ${PIECE_NAMES[piece.toLowerCase()]}` : 'empty';
      const extra = square === this.selected ? ', picked' : targets.includes(square) ? (piece ? ', you can take it' : ', you can move here') : '';
      button.dataset.square = square;
      button.setAttribute('aria-label', `${squareName(square)}, ${what}${extra}`);
    });
    this.el.resign.disabled = Boolean(this.result);
    this.el.moves.textContent = this.sans.join(' ');
    this.el.moves.scrollTop = this.el.moves.scrollHeight;
  }

  roveTo(i) {
    this.buttons[this.focusIndex].tabIndex = -1;
    this.focusIndex = i;
    this.buttons[i].tabIndex = 0;
  }

  // The piece that just moved slides from its old square to its new one.
  slide(move) {
    if (this.reducedMotion.matches) return;
    const token = ++this.slideToken;
    const start = performance.now();
    const frame = (now) => {
      if (token !== this.slideToken) return;
      const t = Math.min(1, (now - start) / SLIDE_MS);
      this.render(t < 1 ? { move, t } : null);
      if (t < 1) requestAnimationFrame(frame);
    };
    frame(start);
  }

  // As big as fits, scaled by whole device pixels like the game (the same three layouts as the game viewer).
  fit() {
    const dpr = window.devicePixelRatio || 1;
    const px = (value) => parseFloat(value) || 0;
    const style = getComputedStyle(this.dialog);
    const gap = px(getComputedStyle(this.el.layout).rowGap);
    const width = this.dialog.clientWidth - px(style.paddingLeft) - px(style.paddingRight);
    const height = window.innerHeight * 0.94 - px(style.borderTopWidth) - px(style.borderBottomWidth) - px(style.paddingTop) - px(style.paddingBottom);
    let room;
    if (matchMedia('(min-width: 760px) and (min-height: 600px)').matches) {
      room = Math.min(width * 0.58, height - this.el.head.offsetHeight - gap);
    } else if (matchMedia('(min-width: 760px) and (max-height: 599px)').matches) {
      room = Math.min(width * 0.5, height);
    } else {
      // One column: the heading, the board, the buttons and the status line, all on screen.
      const title = this.el.title.offsetHeight + px(getComputedStyle(this.el.title).marginBottom);
      room = Math.min(width, height - title - this.el.controls.offsetHeight - 2 * px(getComputedStyle(this.el.status).lineHeight) - 4 * gap);
    }
    const scale = Math.max(1, Math.floor((room * dpr) / SIZE));
    const size = (SIZE * scale) / dpr;
    this.el.board.style.width = `${size}px`;
    this.el.board.style.height = `${size}px`;
    this.dialog.style.setProperty('--board-size', `${size}px`);
  }
}

// A position for the repetition rule: the pieces, whose move it is, castling and en passant (not the move counters).
function positionKey(position) {
  return toFen(position).split(' ').slice(0, 4).join(' ');
}
