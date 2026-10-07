import { BUMP_TICKS, DIRS, TILE, TURN_TICKS } from './constants.js';
import { flipX, fromRows } from './pixels.js';

const LIFT = 3; // characters stand a few pixels up their tile, like in the old games

/**
 * Builds the 12 walking pictures from the text-art frames in src/world/player.js.
 * Right is the mirror of left; the second step of up/down is the mirror of the first.
 */
export function makeCharacterFrames({ palette, frames }) {
  const make = (rows) => fromRows(rows, palette);
  const down = make(frames.down);
  const downStep = make(frames.downStep);
  const up = make(frames.up);
  const upStep = make(frames.upStep);
  const left = make(frames.left);
  const leftStep = make(frames.leftStep);
  return {
    down: { stand: down, stepA: downStep, stepB: flipX(downStep) },
    up: { stand: up, stepA: upStep, stepB: flipX(upStep) },
    left: { stand: left, stepA: leftStep, stepB: leftStep },
    right: { stand: flipX(left), stepA: flipX(leftStep), stepB: flipX(leftStep) },
  };
}

/** A character on the tile grid. It only ever stands on whole tiles and walks one tile at a time. */
export class Actor {
  constructor(frames, { x, y, facing = 'down' }) {
    this.frames = frames;
    this.tx = x;
    this.ty = y;
    this.facing = facing;
    this.state = 'idle'; // idle | turn | walk | bump
    this.timer = 0;
    this.moved = 0; // pixels walked towards the next tile
    this.speed = 1;
    this.foot = 0; // alternates so the legs take turns
    this.visible = true;
    this.order = 1; // drawn after scenery that has the same depth
  }

  get px() {
    return this.tx * TILE + (this.state === 'walk' ? DIRS[this.facing][0] * this.moved : 0);
  }

  get py() {
    return this.ty * TILE + (this.state === 'walk' ? DIRS[this.facing][1] * this.moved : 0);
  }

  get sortY() {
    return this.py + TILE;
  }

  /** The tile the actor is on, or the one it is walking onto. */
  get target() {
    if (this.state !== 'walk') return [this.tx, this.ty];
    const [dx, dy] = DIRS[this.facing];
    return [this.tx + dx, this.ty + dy];
  }

  placeAt(x, y, facing) {
    this.tx = x;
    this.ty = y;
    this.facing = facing;
    this.state = 'idle';
    this.moved = 0;
  }

  turn(dir) {
    this.facing = dir;
    this.state = 'turn';
    this.timer = TURN_TICKS;
    this.foot ^= 1;
  }

  walk(dir, speed) {
    this.facing = dir;
    this.state = 'walk';
    this.moved = 0;
    this.speed = speed;
    this.foot ^= 1;
  }

  bump(dir) {
    this.facing = dir;
    this.state = 'bump';
    this.timer = BUMP_TICKS;
    this.foot ^= 1;
  }

  /** Moves one tick along the current step. Returns true on arriving at the next tile. */
  advance() {
    this.moved += this.speed;
    if (this.moved < TILE) return false;
    const [dx, dy] = DIRS[this.facing];
    this.tx += dx;
    this.ty += dy;
    this.moved = 0;
    this.state = 'idle';
    return true;
  }

  pose() {
    const set = this.frames[this.facing];
    const step = this.foot ? set.stepB : set.stepA;
    if (this.state === 'walk') return this.moved < TILE / 2 ? step : set.stand;
    if (this.state === 'turn') return this.timer > TURN_TICKS / 2 ? step : set.stand;
    if (this.state === 'bump') return this.timer > BUMP_TICKS / 2 ? step : set.stand;
    return set.stand;
  }

  draw(ctx, camX, camY) {
    if (!this.visible) return;
    const sprite = this.pose();
    ctx.drawImage(sprite, this.px - camX + Math.round((TILE - sprite.width) / 2), this.py - camY + TILE - sprite.height - LIFT);
  }
}
