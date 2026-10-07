// A giant keyboard Shift key, drawn in code: the NeuralShift building ("Shift" also makes you run in this game).
// Seen from the front and a little above: the top face with its shallow dish and a hollow up-arrow (no letters, nothing like the company's logo), sloping sides lit from the left, and the front
// skirt with the door. `pressed` draws the key 2 px further down, for while its door is open.

/** Draws the key into a picture W x H (the building uses 88 x 74), with its door exactly in `door`. */
export function drawKeycap(p, { width: W, height: H, door }, colors, { pressed = false } = {}) {
  const c = colors;
  const cx = W / 2;
  const drop = pressed ? 2 : 0;
  const faceTop = 2 + drop;
  const faceBottom = H - 31 + drop; // the top face ends here; the skirt (the front of the key) is below
  // Row by row: the key widens towards the bottom, so its sides slope outwards.
  for (let y = faceTop; y < H; y++) {
    const t = (y - faceTop) / (H - 1 - faceTop);
    const outer = Math.round(W / 2 - 10 + 9 * t); // half width of the whole key on this row
    const left = Math.round(cx - outer);
    const right = Math.round(cx + outer);
    if (y <= faceBottom) {
      const inner = W / 2 - 10; // the top face keeps its width
      p.hline(left, y, Math.round(cx - inner) - left, c.lit);
      p.hline(Math.round(cx - inner), y, inner * 2, c.top);
      p.hline(Math.round(cx + inner), y, right - Math.round(cx + inner), c.shade);
    } else {
      p.hline(left, y, right - left, c.skirt);
    }
  }
  // The rounded corners of the top face, its shallow dish, and the edge where it meets the skirt.
  p.ellipse(cx, faceTop + (faceBottom - faceTop) / 2, W / 2 - 18, (faceBottom - faceTop) / 2 - 5, c.dish);
  p.hline(Math.round(cx - (W / 2 - 10)), faceBottom + 1, W - 20, c.skirtLine);
  for (let y = faceBottom + 6; y < H - 2; y += 6) p.hline(cx - 30, y, 60, c.skirtLine);
  // The Shift arrow, hollow, in the middle of the dish.
  const ay = faceTop + 8;
  for (let i = 0; i <= 11; i++) {
    p.px(cx - 1 - i, ay + i, c.accent).px(cx + i, ay + i, c.accent); // the two slopes of the head
  }
  p.hline(cx - 12, ay + 12, 7, c.accent).hline(cx + 6, ay + 12, 7, c.accent); // the head's base, either side of the stem
  p.vline(cx - 6, ay + 12, 10, c.accent).vline(cx + 5, ay + 12, 10, c.accent).hline(cx - 6, ay + 22, 12, c.accent); // the stem
  // The door goes exactly where the game expects it (it animates the doorway when it opens).
  const bottom = H - 1;
  p.rect(door.x - 2, door.y - 2, door.w + 4, bottom - door.y + 2, c.accent);
  p.rect(door.x, door.y, door.w, bottom - door.y, c.door);
  p.rect(door.x + 2, door.y + 2, door.w - 4, 6, c.skirtLine);
  p.px(door.x + door.w - 4, door.y + 13, c.handle).px(door.x + door.w - 4, door.y + 14, c.handle);
  p.outline(c.line);
}
