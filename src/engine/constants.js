// Sizes are in game pixels and times in ticks. The game runs at a fixed 60 ticks per second,
// and the timings copy Pokemon Emerald / FireRed as documented by the pret decompilation projects.

export const TILE = 16;
export const TICK_MS = 1000 / 60;

// ZOOM: at least this many tiles fit across the shorter side of the window (bigger number = zoomed out).
// On a 1080p screen: 10 gives 5x zoom, 12 gives 4x (the chosen look), 15 gives 3x.
// It is a tile count rather than a fixed "4x" so phones and 4K screens show about as much of the town.
export const ZOOM_TILES = 12;

export const WALK_SPEED = 1; // pixels per tick: 16 ticks per tile
export const RUN_SPEED = 2; // 8 ticks per tile while B / Shift is held
export const TURN_TICKS = 8; // tapping a new direction turns on the spot first
export const BUMP_TICKS = 32; // walking into a wall: slow step in place
export const DOOR_TICKS = 16; // door opening or closing
export const FADE_TICKS = 24; // fade to or from black
export const TEXT_TICKS_PER_CHAR = 2;

export const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
