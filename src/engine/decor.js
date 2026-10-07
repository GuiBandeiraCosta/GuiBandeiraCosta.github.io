import { Painter, fromRows, makeCanvas } from './pixels.js';

// Ready-made decorations. Use them in an interior with { type: 'plant', at: [column, row] }.

function cached(make) {
  let sprite = null;
  return () => (sprite ??= make());
}

export const DECOR = {
  sign: {
    size: [1, 1],
    solid: true,
    sprite: cached(() => {
      const canvas = fromRows(
        [
          '................',
          '................',
          '................',
          '..wwwwwwwwwwww..',
          '..wLLLLLLLLLLw..',
          '..wLddddddddLw..',
          '..wLLLLLLLLLLw..',
          '..wLddddddLLLw..',
          '..wLLLLLLLLLLw..',
          '..wwwwwwwwwwww..',
          '......wPPw......',
          '......wPPw......',
          '......wPPw......',
          '......wPPw......',
          '.....wwwwww.....',
          '................',
        ],
        { w: '#7a4e2c', L: '#e0b47c', d: '#b08050', P: '#a06c40' },
      );
      new Painter(canvas).outline('#3a2414');
      return canvas;
    }),
  },

  plant: {
    size: [1, 1],
    solid: true,
    sprite: cached(() => {
      const p = new Painter(makeCanvas(16, 24));
      p.ellipse(8, 9, 6, 6, '#2e8040').ellipse(7, 8, 5, 5, '#48a850').ellipse(6, 6, 2, 2, '#78cc6c').ellipse(10, 11, 2, 1, '#3c9c4c');
      p.rect(4, 15, 8, 2, '#b85a36').rect(5, 17, 6, 5, '#d8784a').vline(5, 17, 5, '#e8946a').vline(10, 17, 5, '#a84e30');
      p.outline('#2a2420');
      return p.canvas;
    }),
  },

  mat: {
    size: [1, 1],
    solid: false,
    sprite: cached(() => {
      const p = new Painter(makeCanvas(16, 16));
      p.rect(1, 6, 14, 10, '#b03c30').rect(2, 7, 12, 8, '#e06048').hline(3, 9, 10, '#f8d048').hline(3, 12, 10, '#f8d048');
      return p.canvas;
    }),
  },
};

// The stairs between a building's two floors (see "upstairs" in README.md). The game places them against the
// back wall, 1 tile wide and 2 tall; the wall's top edge and sides show around them, whatever the wall looks like.
export const STAIRS = {
  up: cached(() => drawStairs(false)),
  down: cached(() => drawStairs(true)),
};

function drawStairs(down) {
  const p = new Painter(makeCanvas(16, 32));
  p.rect(1, 3, 14, 29, '#1c120c'); // the stairwell
  const tones = ['#4a3020', '#5e3c26', '#74482c', '#8a5634', '#a06a40', '#b47a48', '#c88c56'];
  for (let i = 0; i < tones.length; i++) {
    // Each step is a tread and a darker riser. Going up, the steps nearest the room are the brightest; going down, the furthest.
    const light = down ? tones.length - 1 - i : i;
    p.rect(2, 4 + i * 4, 12, 2, tones[light]).rect(2, 6 + i * 4, 12, 2, tones[Math.max(0, light - 2)]);
  }
  p.rect(1, 3, 2, 29, '#5a3420').vline(1, 3, 29, '#a06a40'); // handrail
  if (down) for (let x = 4; x < 15; x += 3) p.vline(x, 26, 6, '#7a4a2a'); // a banister across the top of the flight
  return p.canvas;
}
