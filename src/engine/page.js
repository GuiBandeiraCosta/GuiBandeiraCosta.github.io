/**
 * The HTML around the game: name plate, hints, touch controls, the link card and screen-reader messages.
 * It is set up before the content loads, so the page still works if a content file has a mistake.
 */
export function setupPage() {
  const $ = (id) => document.getElementById(id);
  const canvas = $('screen');
  const touch = $('touch');
  const hint = $('hint');
  const announcer = $('announcer');
  let announceTimer = 0;
  let linkCard = null;

  // On-screen controls appear on touch screens (or as soon as someone touches the screen).
  const showTouch = (on) => {
    touch.hidden = !on;
    document.body.classList.toggle('touch-ui', on);
  };
  showTouch(matchMedia('(pointer: coarse)').matches);
  window.addEventListener('touchstart', () => showTouch(true), { once: true, passive: true });

  return {
    canvas,
    dpad: touch.querySelector('.dpad'),
    buttonA: touch.querySelector('.button-a'),
    buttonB: touch.querySelector('.button-b'),
    textbox: $('textbox'),
    showContent({ site }) {
      $('site-name').textContent = site.name;
    },
    showHint(text) {
      hint.textContent = text;
      hint.classList.add('is-visible');
    },
    hideHint() {
      hint.classList.remove('is-visible');
    },
    // Every screen-reader message goes through here, so the latest one always wins.
    announce(text) {
      clearTimeout(announceTimer);
      announcer.textContent = '';
      if (text) announceTimer = setTimeout(() => (announcer.textContent = text), 60);
    },
    showError(text) {
      const box = $('page-error');
      box.textContent = text;
      box.hidden = false;
    },
    /**
     * A small card with a real link (e.g. to a paper), which the visitor then clicks. Opening a new tab straight
     * from the game would be blocked as a pop-up, and a real link also works for screen readers.
     */
    showLink({ url, label = 'Open the link', title = 'Here is the link' }) {
      if (!linkCard) {
        linkCard = el('dialog', { className: 'sheet link-card' });
        linkCard.setAttribute('aria-labelledby', 'link-card-title');
        linkCard.innerHTML = `
          <h2 id="link-card-title" tabindex="-1" autofocus></h2>
          <p><a class="plate link-card__go" target="_blank" rel="noopener"></a></p>
          <p class="link-card__url"></p>
          <form method="dialog"><button class="plate">Back to the game</button></form>`;
        document.body.append(linkCard);
        closeOnBackdropClick(linkCard);
        linkCard.addEventListener('close', () => canvas.focus({ preventScroll: true }));
      }
      linkCard.querySelector('h2').textContent = title;
      const link = linkCard.querySelector('a');
      link.href = url;
      link.textContent = `${label} (opens in a new tab)`;
      linkCard.querySelector('.link-card__url').textContent = url;
      if (!linkCard.open) linkCard.showModal();
    },
  };
}

/**
 * Closes a modal <dialog> when the dimmed backdrop around it is clicked. The dialog element also owns
 * the sheet's frame and padding, so check where the pointer is, and ignore text-selection drags that end outside.
 */
export function closeOnBackdropClick(dialog) {
  const outside = (e) => {
    const r = dialog.getBoundingClientRect();
    return e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
  };
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (e) => (pressedOutside = outside(e)));
  dialog.addEventListener('click', (e) => {
    if (pressedOutside && outside(e)) dialog.close();
    pressedOutside = false;
  });
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

