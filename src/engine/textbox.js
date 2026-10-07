import { TEXT_TICKS_PER_CHAR } from './constants.js';

/**
 * The text box at the bottom of the screen. It is real HTML (not pixels on the canvas), so the
 * text is sharp, selectable, and readable by screen readers and search engines.
 * Text types out letter by letter; A or B finishes the page, then shows the next one.
 * The last page can be a question with answers to pick from (like YES / NO in the old games).
 */
export class TextBox {
  constructor(root, announce, input) {
    this.root = root;
    this.textEl = root.querySelector('.textbox__text');
    this.choicesEl = root.querySelector('.textbox__choices');
    this.announce = announce; // tells screen readers the text of each page
    this.input = input;
    this.isOpen = false;
    this.pages = [];
    this.text = '';
    this.shown = 0;
    this.choices = null; // answers to the question on the last page, e.g. ['Yes', 'No']
    this.asking = false; // true while the answers are on screen
    // Clicking or tapping the box counts as pressing A (the main button only: a right-click opens the menu).
    root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      input.press('a');
    });
    // A tap on the answers box never counts as A (that would pick whichever answer has the cursor):
    // only its buttons choose. preventDefault keeps the keyboard focus on the game.
    this.choicesEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  }

  /** Shows pages of text. With `choices`, the last page is a question and onChoose(index) gets the answer. */
  open(pages, { choices = null, onChoose = null } = {}) {
    this.pages = (Array.isArray(pages) ? pages : [pages]).map(String);
    if (this.pages.length === 0) return;
    this.choices = choices?.length ? choices : null;
    this.onChoose = onChoose;
    this.asking = false;
    this.choicesEl.hidden = true;
    this.index = 0;
    this.isOpen = true;
    this.root.hidden = false;
    this.showPage();
  }

  showPage() {
    this.text = this.pages[this.index];
    this.shown = 0;
    this.ticks = 0;
    // The not-yet-typed part is present but invisible, so words never jump between lines.
    this.typed = document.createElement('span');
    this.rest = document.createElement('span');
    this.rest.className = 'textbox__rest';
    this.rest.textContent = this.text;
    this.textEl.replaceChildren(this.typed, this.rest);
    this.root.classList.remove('is-done');
    // A question is announced once, together with its answers, when it has finished typing (see ask()).
    if (!(this.choices && this.index === this.pages.length - 1)) this.announce(this.text);
  }

  update() {
    if (this.asking) {
      this.updateAnswer();
      return;
    }
    // Down turns the page too. The key is let go of, so if this page was the last one, holding Down doesn't also walk
    // (often off the exit mat, out of the room).
    const down = this.input.consume('dir') === 'down';
    if (down) this.input.releaseDirections();
    const advance = this.input.consume('a') || this.input.consume('b') || down;
    if (this.shown < this.text.length) {
      if (advance) this.shown = this.text.length;
      else if (++this.ticks >= TEXT_TICKS_PER_CHAR) {
        this.ticks = 0;
        this.shown++;
      }
      this.typed.textContent = this.text.slice(0, this.shown);
      this.rest.textContent = this.text.slice(this.shown);
      if (this.shown >= this.text.length) {
        if (this.choices && this.index === this.pages.length - 1) this.ask();
        else this.root.classList.add('is-done');
      }
    } else if (advance) {
      if (++this.index < this.pages.length) this.showPage();
      else this.close();
    }
  }

  ask() {
    this.asking = true;
    this.choicesEl.replaceChildren(
      ...this.choices.map((label, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'textbox__choice';
        button.textContent = label;
        button.addEventListener('click', () => this.asking && this.choose(i));
        return button;
      }),
    );
    this.select(0, false);
    this.choicesEl.hidden = false;
    this.announce(`${this.text} ${this.choices.join(' or ')}. ${this.choices[0]} is selected: the arrow keys change it, Enter chooses.`);
  }

  updateAnswer() {
    const dir = this.input.consume('dir');
    if (dir === 'up' || dir === 'left') this.select(this.selected - 1);
    if (dir === 'down' || dir === 'right') this.select(this.selected + 1);
    if (this.input.consume('a')) this.choose(this.selected);
    else if (this.input.consume('b')) this.choose(this.choices.length - 1); // B means "no", like in the old games
  }

  select(index, announce = true) {
    this.selected = Math.min(Math.max(index, 0), this.choices.length - 1);
    [...this.choicesEl.children].forEach((button, i) => {
      button.classList.toggle('is-selected', i === this.selected);
      button.setAttribute('aria-current', String(i === this.selected));
    });
    if (announce) this.announce(this.choices[this.selected]); // screen readers can't see the cursor move
  }

  choose(index) {
    const onChoose = this.onChoose;
    this.close();
    onChoose?.(index);
  }

  close() {
    this.isOpen = false;
    this.asking = false;
    this.root.hidden = true;
    this.choicesEl.hidden = true;
    this.announce('');
  }
}
