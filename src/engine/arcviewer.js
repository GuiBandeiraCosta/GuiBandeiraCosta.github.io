import { ARC_COLORS, ARC_NAMES, copyGrid, describeGrid, readTask, sameGrid } from './arc.js';
import { closeOnBackdropClick } from './page.js';

// The ARC puzzle sheet: a few example grids, each next to its answer, and an empty grid where the visitor paints
// the answer to a new one with ARC's ten colours, then checks it. It is an HTML <dialog>, so it works with the
// keyboard, the mouse and touch, and screen readers can follow it. "See it as the model does" lays the grid out as
// one long line, the way a language model reads it: neighbours side by side stay together, but the square below
// ends up a whole row away (the point of the owner's paper).
// A building uses it through a decoration with `arc: { task, title, intro, ask, onSolve }` (see README.md).

const CLOSE_ICON = '<svg viewBox="0 0 7 7" aria-hidden="true"><path d="M0 0h1v1H0zM6 0h1v1H6zM1 1h1v1H1zM5 1h1v1H5zM2 2h1v1H2zM4 2h1v1H4zM3 3h1v1H3zM2 4h1v1H2zM4 4h1v1H4zM1 5h1v1H1zM5 5h1v1H5zM0 6h1v1H0zM6 6h1v1H6z"/></svg>';
const MOVES = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const CELL = 6; // game pixels per cell in the example pictures (plus a 1 px line between cells)

export class ArcViewer {
  constructor(onClose) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'sheet arc';
    this.dialog.setAttribute('aria-labelledby', 'arc-title');
    // The DOM order is the Tab order: the answer and its tools come before the long list of examples on phones (CSS).
    this.dialog.innerHTML = `
      <div class="arc__layout">
        <div class="arc__head">
          <h2 id="arc-title" tabindex="-1" autofocus></h2>
          <form method="dialog" class="arc__close"><button class="plate" aria-label="Back to the room">${CLOSE_ICON}</button></form>
          <p class="arc__intro"></p>
        </div>
        <section class="arc__examples" aria-labelledby="arc-examples-title">
          <h3 id="arc-examples-title">Examples</h3>
          <ol class="arc__pairs"></ol>
        </section>
        <section class="arc__test" aria-labelledby="arc-test-title">
          <h3 id="arc-test-title">Your turn</h3>
          <div class="arc__pair arc__pair--test">
            <figure class="arc__figure"><canvas class="arc__picture" aria-hidden="true"></canvas><figcaption class="sr-only"></figcaption></figure>
            <span class="arc__arrow" aria-hidden="true"></span>
            <div class="arc__answer" role="group" aria-label="Your answer"></div>
          </div>
          <div class="arc__palette" role="group" aria-label="Colours"></div>
          <div class="arc__tools">
            <button type="button" class="plate" data-do="copy">Copy the input</button>
            <button type="button" class="plate" data-do="reset">Clear</button>
            <button type="button" class="plate arc__check" data-do="check">Check</button>
          </div>
          <p class="arc__status" aria-live="polite"></p>
          <div class="arc__options">
            <label><input type="checkbox" class="arc__numbers"> Show the colour numbers</label>
            <label><input type="checkbox" class="arc__model"> See it as the model does</label>
          </div>
          <div class="arc__strip" hidden>
            <p class="arc__strip-note"></p>
            <div class="arc__line" aria-hidden="true"></div>
          </div>
        </section>
        <form method="dialog" class="arc__foot"><button class="plate">Back to the room</button></form>
      </div>
      <p class="sr-only arc__said" aria-live="polite"></p>`;
    document.body.append(this.dialog);
    const $ = (selector) => this.dialog.querySelector(selector);
    this.el = {
      title: $('h2'),
      intro: $('.arc__intro'),
      pairs: $('.arc__pairs'),
      testPicture: $('.arc__pair--test canvas'),
      testCaption: $('.arc__pair--test figcaption'),
      answer: $('.arc__answer'),
      palette: $('.arc__palette'),
      status: $('.arc__status'),
      numbers: $('.arc__numbers'),
      model: $('.arc__model'),
      strip: $('.arc__strip'),
      stripNote: $('.arc__strip-note'),
      line: $('.arc__line'),
      said: $('.arc__said'),
    };
    this.color = 1;
    this.cursor = [0, 0];
    this.buildPalette();

    this.dialog.querySelector('.arc__tools').addEventListener('click', (e) => {
      const action = e.target.closest('button')?.dataset.do;
      if (action === 'copy') this.copyInput();
      if (action === 'reset') this.clear();
      if (action === 'check') this.check();
    });
    this.el.answer.addEventListener('click', (e) => {
      const cell = e.target.closest('button');
      if (cell) this.paint(Number(cell.dataset.x), Number(cell.dataset.y), this.color);
    });
    this.el.answer.addEventListener('focusin', (e) => {
      const cell = e.target.closest('button');
      if (cell) this.moveTo(Number(cell.dataset.x), Number(cell.dataset.y), false);
    });
    this.el.answer.addEventListener('keydown', (e) => this.onGridKey(e));
    this.el.numbers.addEventListener('change', () => this.dialog.classList.toggle('shows-numbers', this.el.numbers.checked));
    this.el.model.addEventListener('change', () => {
      this.el.strip.hidden = !this.el.model.checked;
      this.highlight();
    });
    closeOnBackdropClick(this.dialog);
    this.dialog.addEventListener('close', () => {
      onClose?.();
      // The room can react once the sheet is closed (the text box can't show under a modal dialog).
      if (this.solved && !this.reported) {
        this.reported = true;
        this.options.onSolve?.(this.ctx);
      }
      this.options.onClose?.(this.ctx, this.solved); // solved or not, e.g. to carry on with a scene

    });
  }

  /**
   * Opens the sheet on a puzzle: { task, title, intro, solvedText, onSolve, onClose }. The task is ARC's JSON, or rows
   * of digits. onSolve(ctx) runs once it closes after a right answer; onClose(ctx, solved) runs whenever it closes.
   */
  open(options, ctx) {
    this.options = options;
    this.ctx = ctx;
    this.solved = false;
    this.reported = false;
    try {
      this.task = readTask(options.task);
    } catch (err) {
      console.error(`[arc] The puzzle could not be read: ${err.message}`);
      this.task = null;
    }
    this.el.title.textContent = options.title ?? 'An ARC puzzle';
    this.el.intro.textContent = options.intro ?? 'Each example shows a grid and its answer. Find the rule, then paint the answer to the new grid and press Check.';
    this.el.status.textContent = this.task ? '' : 'Sorry, this puzzle could not be read.';
    this.dialog.querySelectorAll('.arc__tools button').forEach((button) => (button.disabled = !this.task));
    if (this.task) {
      this.fillExamples();
      const test = this.task.test[0];
      draw(this.el.testPicture, test.input);
      this.el.testCaption.textContent = `The new grid: ${describeGrid(test.input)}`;
      const [w, h] = [test.output[0].length, test.output.length];
      // Start from a copy of the input when the answer is the same size (most ARC puzzles), otherwise from black.
      const sameSize = test.input.length === h && test.input[0].length === w;
      this.grid = sameSize ? copyGrid(test.input) : Array.from({ length: h }, () => Array(w).fill(0));
      this.cursor = [0, 0];
      this.buildAnswer();
    }
    if (!this.dialog.open) this.dialog.showModal();
  }

  fillExamples() {
    this.el.pairs.replaceChildren(
      ...this.task.train.map((pair, i) => {
        const item = document.createElement('li');
        item.className = 'arc__pair';
        const figure = (grid, label) => {
          const fig = document.createElement('figure');
          fig.className = 'arc__figure';
          const canvas = document.createElement('canvas');
          canvas.className = 'arc__picture';
          canvas.setAttribute('aria-hidden', 'true');
          draw(canvas, grid);
          const caption = document.createElement('figcaption');
          caption.className = 'sr-only';
          caption.textContent = `${label}: ${describeGrid(grid)}`;
          fig.append(canvas, caption);
          return fig;
        };
        const arrow = document.createElement('span');
        arrow.className = 'arc__arrow';
        arrow.setAttribute('aria-hidden', 'true');
        item.append(figure(pair.input, `Example ${i + 1}, the grid`), arrow, figure(pair.output, `Example ${i + 1}, its answer`));
        return item;
      }),
    );
  }

  buildPalette() {
    this.el.palette.replaceChildren(
      ...ARC_COLORS.map((color, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'arc__swatch';
        button.style.setProperty('--color', color);
        button.dataset.value = i;
        button.textContent = i;
        button.setAttribute('aria-label', `${ARC_NAMES[i]} (${i})`);
        button.addEventListener('click', () => this.pick(i));
        return button;
      }),
    );
    this.pick(this.color, false);
  }

  pick(value, announce = true) {
    this.color = value;
    [...this.el.palette.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === value)));
    if (announce) this.say(`Colour: ${ARC_NAMES[value]}`);
  }

  // The answer grid: one button per cell, and a single Tab stop (the arrow keys move between cells).
  buildAnswer() {
    const [w, h] = [this.grid[0].length, this.grid.length];
    this.el.answer.style.setProperty('--columns', w);
    this.el.answer.style.setProperty('--rows', h);
    this.el.answer.setAttribute('aria-label', `Your answer, ${w} by ${h}. Arrow keys move, Enter or Space paints with the chosen colour, and the keys 0 to 9 paint that colour.`);
    const cells = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'arc__cell';
        button.dataset.x = x;
        button.dataset.y = y;
        cells.push(button);
      }
    }
    this.el.answer.replaceChildren(...cells);
    this.cells = cells;
    this.cells.forEach((_, i) => this.refreshCell(i % w, Math.floor(i / w)));
    this.buildLine();
    this.moveTo(0, 0, false);
  }

  cellAt(x, y) {
    return this.cells[y * this.grid[0].length + x];
  }

  refreshCell(x, y) {
    const value = this.grid[y][x];
    const cell = this.cellAt(x, y);
    cell.style.setProperty('--color', ARC_COLORS[value]);
    cell.dataset.value = value;
    cell.textContent = value;
    cell.setAttribute('aria-label', `Row ${y + 1}, column ${x + 1}: ${ARC_NAMES[value]}`);
    const square = this.el.line.children[y * this.grid[0].length + x];
    if (square) square.style.setProperty('--color', ARC_COLORS[value]);
  }

  paint(x, y, value) {
    if (!this.grid) return;
    this.grid[y][x] = value;
    this.refreshCell(x, y);
    this.moveTo(x, y, false);
    this.say(`Row ${y + 1}, column ${x + 1}: ${ARC_NAMES[value]}`);
    this.el.status.textContent = '';
  }

  moveTo(x, y, focus = true) {
    this.cursor = [x, y];
    this.cells.forEach((cell) => (cell.tabIndex = -1));
    const cell = this.cellAt(x, y);
    cell.tabIndex = 0;
    if (focus) cell.focus();
    this.highlight();
  }

  onGridKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const [x, y] = this.cursor;
    const [w, h] = [this.grid[0].length, this.grid.length];
    if (MOVES[e.key]) {
      e.preventDefault();
      const [dx, dy] = MOVES[e.key];
      this.moveTo(Math.min(Math.max(x + dx, 0), w - 1), Math.min(Math.max(y + dy, 0), h - 1));
    } else if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      this.pick(Number(e.key), false);
      this.paint(x, y, Number(e.key));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      this.moveTo(e.key === 'Home' ? 0 : w - 1, y);
    }
  }

  copyInput() {
    const input = this.task.test[0].input;
    if (input.length !== this.grid.length || input[0].length !== this.grid[0].length) {
      this.el.status.textContent = 'The answer is a different size from the new grid, so it starts empty.';
      return;
    }
    this.grid = copyGrid(input);
    this.cells.forEach((_, i) => this.refreshCell(i % input[0].length, Math.floor(i / input[0].length)));
    this.el.status.textContent = 'Copied the new grid into your answer.';
  }

  clear() {
    this.grid = this.grid.map((row) => row.map(() => 0));
    this.cells.forEach((_, i) => this.refreshCell(i % this.grid[0].length, Math.floor(i / this.grid[0].length)));
    this.el.status.textContent = 'Cleared: every cell is black again.';
  }

  check() {
    const expected = this.task.test[0].output;
    if (sameGrid(this.grid, expected)) {
      this.solved = true;
      this.el.status.textContent = this.options.solvedText ?? 'Solved! Every cell is right. That is how ARC scores it: only exact answers count.';
      return;
    }
    let wrong = 0;
    expected.forEach((row, y) => row.forEach((value, x) => (wrong += this.grid[y][x] !== value ? 1 : 0)));
    this.el.status.textContent = `Not quite: ${wrong} ${wrong === 1 ? 'cell is' : 'cells are'} different. ARC only counts exact answers.`;
  }

  // "See it as the model does": the answer as one line of cells, in reading order.
  buildLine() {
    const [w, h] = [this.grid[0].length, this.grid.length];
    this.el.line.style.setProperty('--count', w * h);
    this.el.line.replaceChildren(
      ...this.grid.flat().map((value) => {
        const square = document.createElement('span');
        square.className = 'arc__square';
        square.style.setProperty('--color', ARC_COLORS[value]);
        return square;
      }),
    );
  }

  // The chosen cell and its four neighbours, lit in the grid and in the line: up and down end up a whole row apart.
  highlight() {
    if (!this.cells) return;
    const [x, y] = this.cursor;
    const w = this.grid[0].length;
    const near = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([i, j]) => i >= 0 && j >= 0 && i < w && j < this.grid.length);
    const lit = new Set(near.map(([i, j]) => j * w + i));
    this.cells.forEach((cell, i) => cell.classList.toggle('is-near', this.el.model.checked && lit.has(i)));
    [...this.el.line.children].forEach((square, i) => {
      square.classList.toggle('is-here', i === y * w + x);
      square.classList.toggle('is-near', lit.has(i));
    });
    const index = y * w + x;
    const below = y + 1 < this.grid.length ? `the square below it is ${w} steps along, at ${index + w + 1}` : 'it is on the bottom row';
    this.el.stripNote.textContent = `Square ${index + 1} of ${this.grid.flat().length} in the line. Its left and right neighbours are next to it, but ${below}.`;
  }

  say(text) {
    this.el.said.textContent = '';
    setTimeout(() => (this.el.said.textContent = text), 30);
  }
}

// Draws a grid on a small canvas, one colour per cell with dark lines between, scaled up crisply by CSS.
function draw(canvas, grid) {
  const [w, h] = [grid[0].length, grid.length];
  canvas.width = w * (CELL + 1) + 1;
  canvas.height = h * (CELL + 1) + 1;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#444444';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  grid.forEach((row, y) => row.forEach((value, x) => {
    ctx.fillStyle = ARC_COLORS[value];
    ctx.fillRect(1 + x * (CELL + 1), 1 + y * (CELL + 1), CELL, CELL);
  }));
  canvas.style.setProperty('--columns', w);
  canvas.style.setProperty('--rows', h);
}
