import { TICK_MS } from './constants.js';

/**
 * Calls update() exactly 60 times per second of real time and render() once per screen refresh.
 * If either throws, onError(error) is called once and the loop keeps going.
 */
export function startLoop(update, render, onError) {
  let last = performance.now();
  let pending = 0;
  let failed = false;

  // A hidden tab gets no frames: when it comes back, carry on from where it was instead of fast-forwarding.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = Math.min(now - last, 250);
    last = now;
    // Browsers round frame times (to 0.1 ms or 1 ms). Snap tiny jitter to whole ticks on 60 Hz screens,
    // and to half or quarter ticks on 120 / 240 Hz ones, so every step stays exactly as long as the others.
    const ticks = Math.round(elapsed / TICK_MS);
    const quarters = Math.round(elapsed / (TICK_MS / 4));
    if (ticks >= 1 && Math.abs(elapsed - ticks * TICK_MS) < 1) elapsed = ticks * TICK_MS;
    else if (quarters >= 1 && Math.abs(elapsed - (quarters * TICK_MS) / 4) < 0.5) elapsed = (quarters * TICK_MS) / 4;
    pending += elapsed;
    try {
      while (pending >= TICK_MS - 0.01) {
        update();
        pending -= TICK_MS;
      }
      render();
    } catch (err) {
      pending = 0;
      if (!failed) {
        failed = true;
        console.error(err);
        onError?.(err);
      }
    }
  }

  requestAnimationFrame(frame);
}
