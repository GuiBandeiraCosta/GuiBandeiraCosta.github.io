import { DIRS, DOOR_TICKS, FADE_TICKS, RUN_SPEED, TILE, WALK_SPEED } from './constants.js';
import { Actor, makeCharacterFrames } from './actor.js';
import { Input } from './input.js';
import { startLoop } from './loop.js';
import { explore, nearest, pathTo } from './pathfind.js';
import { drawNumber, makeCanvas } from './pixels.js';
import { Screen } from './screen.js';
import { TextBox } from './textbox.js';
import { TileCache } from './tiles.js';
import { buildInterior, buildTown } from './world.js';

const SIDES = ['up', 'down', 'left', 'right'];
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toPages = (text) => (text == null || text === false ? [] : (Array.isArray(text) ? text : [text]).map(String));
// Signs, decorations and characters with something to say, ask or show.
const isReadable = (thing) => Boolean(thing && (thing.text || thing.ask || thing.use || thing.link || thing.game || thing.arc));
// Dialogs a decoration can offer after its text. Each is only downloaded the first time someone reads about it.
const VIEWERS = {
  chess: { load: () => import('./chessviewer.js'), make: (m, onClose) => new m.ChessViewer(onClose), ask: 'Do you want to see the game?' },
  arc: { load: () => import('./arcviewer.js'), make: (m, onClose) => new m.ArcViewer(onClose), ask: 'Do you want to try the puzzle?' },
  // A game against Stockfish (no decoration field: a room opens it with ctx.show('battle', options)).
  battle: { load: () => import('./chessbattle.js'), make: (m, onClose) => new m.ChessBattle(onClose), ask: 'Do you want to play?' },
};

function* wait(ticks) {
  for (let i = 0; i < ticks; i++) yield;
}

export class Game {
  constructor({ page, town, buildings, player }) {
    this.page = page;
    this.content = { town, buildings, player };
    this.screen = new Screen(page.canvas);
    this.input = new Input(page.canvas);
    this.input.bindDpad(page.dpad);
    this.input.bindButton(page.buttonA, 'a');
    this.input.bindButton(page.buttonB, 'b');
    this.textbox = new TextBox(page.textbox, (text) => page.announce(text), this.input);
    this.tiles = new TileCache();
    this.controlsHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--controls-height')) || 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.showGrid = new URLSearchParams(location.search).has('grid');
    this.tick = 0;
    this.fade = 0; // 0 = normal, 1 = black
    this.script = null; // a running cutscene, e.g. walking through a door
    this.queued = []; // cutscenes waiting for the current one to finish
    this.route = null; // steps planned by tapping or clicking the map
    this.marker = null;
    this.camX = 0;
    this.camY = 0;
    this.hasMoved = false;
    this.viewerModules = {};
    this.viewers = {};
  }

  async load() {
    const { town, buildings, player } = this.content;
    const result = await buildTown(town, buildings, { player });
    this.town = result.area;
    this.buildings = result.buildings;
    this.interiors = new Map();
    for (const building of this.buildings) {
      try {
        this.interiors.set(building.id, await buildInterior(building, { player }));
      } catch (err) {
        console.error(`[town] Building "${building.id}": its inside could not be built: ${err.message}`);
      }
    }
    let spawn = result.spawn;
    // ?start=<building id> starts in front of that building's door (handy for testing one building).
    const start = new URLSearchParams(location.search).get('start');
    if (start) {
      const building = this.buildings.find((b) => b.id === start);
      if (building) spawn = { at: [building.door.x, building.door.y + 1], facing: 'up' };
      else console.warn(`[town] ?start=${start}: there is no building with that id`);
    }
    this.player = new Actor(makeCharacterFrames(player), { x: spawn.at[0], y: spawn.at[1], facing: spawn.facing });
    this.area = this.town;
  }

  start() {
    startLoop(
      () => this.update(),
      () => this.render(),
      (err) => this.page.showError(`Something went wrong: ${err.message}`),
    );
    this.page.showHint(
      this.input.lastDevice === 'touch' ? 'Tap to walk. Tap a building to go in.' : 'Arrow keys or WASD to walk. Walk into a door to go inside.',
    );
  }

  // ---------------------------------------------------------------- update (60 times a second)

  update() {
    this.tick++;
    const tap = this.input.taps[this.input.taps.length - 1];
    if (this.textbox.isOpen) {
      if (tap) this.input.press('a');
      this.textbox.update();
    } else if (this.script) {
      this.stepScript();
    } else {
      if (tap) this.onTap(tap);
      this.updatePlayer();
      if (!this.textbox.isOpen && !this.script) this.hook('update');
    }
    if (this.marker && --this.marker.ticks <= 0) this.marker = null;
    this.input.endTick();
  }

  updatePlayer() {
    const p = this.player;
    // Letting go of the keys (even in the middle of a bump) lets the next walk into a sign read it again.
    if (!this.input.dir && !this.input.pressed.dir) {
      this.bumpRead = null;
      this.bumpTouch = null;
    }
    // A also works while turning on the spot or bumping into something (e.g. walking into a sign).
    if ((p.state === 'turn' || p.state === 'bump') && this.input.consume('a')) {
      this.interact();
      if (this.textbox.isOpen || this.script) {
        p.state = 'idle';
        return;
      }
    }
    switch (p.state) {
      case 'walk':
        if (p.advance()) {
          this.arrived();
          // A room can react to a step (show text, start a scene): then stop here, even if a key is still held.
          if (this.textbox.isOpen || this.script) this.route = null;
          else this.decide(true); // keep walking without stopping if a direction is still held
        }
        break;
      case 'turn':
        if (--p.timer <= 0) {
          p.state = 'idle';
          if (this.input.dir === p.facing) {
            this.route = null; // the held key takes over from any tap
            this.tryStep(p.facing);
          }
        }
        break;
      case 'bump':
        if (--p.timer <= 0) {
          p.state = 'idle';
          this.decide(true);
        }
        break;
      default:
        this.decide(false);
    }
  }

  /** Called whenever the player stands on a tile, ready for the next action. */
  decide(moving) {
    const p = this.player;
    if (this.input.consume('a')) {
      this.interact();
      if (this.textbox.isOpen || this.script) return;
    }
    // A tap so quick it was already released before this frame still counts (it turns, like any tap).
    const dir = this.input.dir ?? this.input.pressed.dir;
    if (dir) {
      this.route = null;
      this.startedMoving();
      // Tapping a new direction while standing still only turns; holding it then walks.
      if (dir !== p.facing && !moving) p.turn(dir);
      else this.tryStep(dir);
    } else if (this.route) {
      this.followRoute();
    }
  }

  tryStep(dir) {
    const p = this.player;
    const area = this.area;
    const [dx, dy] = DIRS[dir];
    const [tx, ty] = [p.tx + dx, p.ty + dy];
    const here = area.warpAt(p.tx, p.ty);
    if (here?.type === 'exit' && here.dir === dir) {
      p.facing = dir;
      this.run(this.leave(here));
      return;
    }
    const ahead = area.warpAt(tx, ty);
    if (ahead?.type === 'door' && ahead.dir === dir && this.interiors.has(ahead.building.id)) {
      p.facing = dir;
      this.run(this.enter(ahead));
      return;
    }
    if (ahead?.type === 'stairs' && ahead.dir === dir) {
      p.facing = dir;
      this.run(this.climb(ahead));
      return;
    }
    if (area.isSolid(tx, ty)) {
      // Walking into a sign or a table reads it, once per press of the key (holding it doesn't repeat).
      const thing = area.objectAt(tx, ty);
      if (isReadable(thing) && this.bumpRead !== thing) {
        p.facing = dir;
        this.route = null;
        this.interact();
        return;
      }
      // Walking into anything else lets the room react (e.g. a lever), also once per press.
      const spot = `${tx},${ty}`;
      if (!isReadable(thing) && area.hooks?.onTouch && this.bumpTouch !== spot) {
        this.bumpTouch = spot;
        p.facing = dir;
        this.hook('onTouch', tx, ty);
        if (this.textbox.isOpen || this.script) {
          this.route = null;
          return;
        }
      }
      p.bump(dir);
      this.route = null;
      return;
    }
    this.bumpRead = null;
    this.bumpTouch = null;
    p.walk(dir, this.input.run ? RUN_SPEED : WALK_SPEED);
  }

  arrived() {
    const p = this.player;
    const ahead = this.area.warpAt(p.tx, p.ty - 1);
    if (ahead?.type === 'door') this.page.announce(`${ahead.building.name}. Walk up to go inside.`);
    if (ahead?.type === 'stairs') this.page.announce(`Stairs ${ahead.goesUp ? 'up' : 'down'}. Walk up to take them.`);
    if (this.area.exit && p.tx === this.area.exit.x && p.ty === this.area.exit.y) this.page.announce('Exit. Walk down to go outside.');
    this.hook('onStep', p.tx, p.ty);
  }

  interact() {
    const p = this.player;
    const [dx, dy] = DIRS[p.facing];
    const [tx, ty] = [p.tx + dx, p.ty + dy];
    const thing = this.area.objectAt(tx, ty);
    if (!isReadable(thing)) {
      this.hook('onUse', tx, ty); // A in front of anything else: the room may react (e.g. paint a floor cell)
      return;
    }
    this.route = null;
    this.bumpRead = thing; // a key still held towards it when the text closes (e.g. Up from YES / NO) doesn't read it again
    this.startedMoving();
    if (thing.npc) this.turnToPlayer(thing);
    this.read(thing);
  }

  /** Shows what a sign, decoration or character says, then any question, link or viewer it offers. */
  read(thing) {
    const ctx = this.context(thing);
    let pages = toPages(this.call(thing.label, 'text', thing.text, ctx));
    let asked = null;
    if (thing.use) {
      // `use` may return pages to show, or a question to ask; anything else (nothing, a promise) adds nothing.
      const result = this.call(thing.label, 'use', thing.use, ctx);
      if (result?.question) asked = result;
      else if (typeof result === 'string' || Array.isArray(result)) pages = pages.concat(toPages(result));
    }
    if (this.textbox.isOpen) return; // its `use` already said something itself (ctx.say)
    const viewer = thing.game ? 'chess' : thing.arc ? 'arc' : null;
    if (viewer) {
      const options = thing.game ?? thing.arc;
      this.loadViewer(viewer); // download it while the visitor reads, so "Yes" opens it at once
      this.ask({ text: pages, question: options.ask ?? VIEWERS[viewer].ask, answers: [() => this.showViewer(viewer, options, ctx)] }, ctx);
      return;
    }
    if (thing.link) {
      const { url, label, ask } = thing.link;
      this.ask({ text: pages, question: ask ?? 'Do you want to open it?', answers: [() => this.page.showLink({ url, label })] }, ctx);
      return;
    }
    const ask = asked ?? this.call(thing.label, 'ask', thing.ask, ctx);
    if (ask?.question) this.ask({ ...ask, text: [...pages, ...toPages(ask.text)] }, ctx);
    else if (pages.length) this.textbox.open(pages);
  }

  /**
   * A question in the text box, like YES / NO in the old games: { text, question, choices, answers }.
   * `text` are pages shown first; `choices` default to Yes / No; B picks the last one. Each answer is pages
   * to show, another question (to chain them), or a function (ctx) => either of those (or nothing).
   */
  ask(question, ctx) {
    this.textbox.open([...toPages(question.text), String(question.question)], {
      choices: question.choices ?? ['Yes', 'No'],
      onChoose: (i) => this.answer(question.answers?.[i], ctx),
    });
  }

  answer(result, ctx) {
    const value = this.call(ctx.thing?.label ?? ctx.area.name, 'answer', result, ctx);
    // Nothing more to show: no value, true/false, a promise (e.g. a dialog opening), or the answer already spoke itself.
    if (value == null || typeof value === 'boolean' || typeof value.then === 'function' || this.textbox.isOpen) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (value.question) this.ask(value, ctx);
      else console.warn(`[town] ${ctx.thing?.label ?? ctx.area.name}: an answer returned an object with no "question"`);
      return;
    }
    const pages = toPages(value);
    if (pages.length) this.textbox.open(pages);
  }

  /** For scripts: asks a question and gives back the answer's number: const i = yield* ctx.choose('Ready?', ['Yes', 'No']). */
  *choose(question, choices = ['Yes', 'No']) {
    const q = typeof question === 'object' && !Array.isArray(question) ? question : { question };
    let picked = null;
    this.textbox.open([...toPages(q.text), String(q.question)], { choices: q.choices ?? choices, onChoose: (i) => (picked = i) });
    while (picked === null) yield;
    return picked;
  }

  // Characters turn to face whoever talks to them (`npc.turns`: true, 'sideways' for left/right only, or false).
  turnToPlayer(thing) {
    const turns = thing.npc.turns ?? true;
    const facing = OPPOSITE[this.player.facing];
    if (turns === true || (turns === 'sideways' && (facing === 'left' || facing === 'right'))) thing.facing = facing;
  }

  // ---------------------------------------------------------------- content scripting

  /**
   * What content functions get as `ctx` (hooks, `use`, answers, scripts, `text` functions): the building's state,
   * the room, and safe ways to talk, ask, change tiles and run scenes. See "Interactive rooms" in README.md.
   */
  context(thing = null) {
    const game = this;
    const area = this.area;
    const p = this.player;
    const label = thing?.label ?? area.name;
    const ctx = {
      state: area.state ?? {},
      area,
      building: area.building ?? null,
      thing,
      get tick() {
        return game.tick;
      },
      get player() {
        return { x: p.tx, y: p.ty, facing: p.facing };
      },
      reducedMotion: this.reducedMotion.matches,
      say: (pages) => toPages(pages).length && game.textbox.open(toPages(pages)),
      ask: (question) => game.ask(question, ctx),
      choose: (question, choices) => game.choose(question, choices),
      announce: (text) => game.page.announce(text),
      tileAt: (x, y) => area.charAt(x, y),
      setTile: (x, y, ch) => area.setTile(x, y, ch),
      resetTiles: () => area.reset(),
      objectAt: (x, y) => area.objectAt(x, y),
      remove: (object) => area.remove(object),
      setSolid: (object, solid) => area.setSolid(object, solid),
      run: (script) => game.runContent(script, ctx, label),
      wait,
      walk: (dir) => game.walk(dir),
      fade: (to) => game.fadeTo(to),
      face: (dir) => DIRS[dir] && (p.facing = dir),
      tint: (palette) => game.tintPlayer(palette),
      overlay: (draw) => (area.liveOverlay = draw ?? null),
      openLink: (url, label) => game.page.showLink({ url, label }),
      // Opens a dialog from a room: 'arc' (an ARC puzzle sheet) or 'battle' (a game against Stockfish). It may be
      // called at the end of a scene; the dialog opens once it has downloaded.
      show: (name, options) => (VIEWERS[name] ? game.showViewer(name, options, ctx, { fromScene: true }) : console.warn(`[town] ${label}: there is no "${name}" dialog`)),
      preload: (name) => VIEWERS[name] && game.loadViewer(name),
      travel: (id) => game.travelTo(id),
      game,
    };
    return ctx;
  }

  // Calls a content function safely: a mistake in it is reported once in the console, and the game carries on.
  call(label, what, value, ctx) {
    if (typeof value !== 'function') return value;
    try {
      return value(ctx);
    } catch (err) {
      console.error(`[town] ${label}: its "${what}" failed: ${err.message}`);
      return null;
    }
  }

  // Runs a room's hook (onEnter, onStep...). A hook that throws is turned off, so it can't fail on every tick.
  hook(name, ...args) {
    const area = this.area;
    const fn = area.hooks?.[name];
    if (!fn) return undefined;
    try {
      return fn(this.context(), ...args);
    } catch (err) {
      delete area.hooks[name];
      console.error(`[town] ${area.name}: its "${name}" failed and was turned off: ${err.message}`);
      return undefined;
    }
  }

  /** Runs a content scene: a generator function (ctx) => { ...; yield; ... } where each yield waits one tick. */
  runContent(script, ctx, label) {
    const game = this;
    this.run(
      (function* () {
        let it;
        try {
          it = script(ctx);
        } catch (err) {
          console.error(`[town] ${label}: its scene failed: ${err.message}`);
          return;
        }
        if (!it || typeof it.next !== 'function') return; // a plain function: it already ran
        for (;;) {
          let step;
          try {
            step = it.next();
          } catch (err) {
            console.error(`[town] ${label}: its scene failed: ${err.message}`);
            game.area.liveOverlay = null;
            return;
          }
          if (step.done) return;
          yield;
        }
      })(),
    );
  }

  // Recolours the player's clothes (e.g. to show which paint they carry). null puts them back.
  tintPlayer(palette) {
    const look = this.content.player;
    const key = palette ? JSON.stringify(palette) : '';
    this.tintCache ??= new Map();
    if (!this.tintCache.has(key)) this.tintCache.set(key, makeCharacterFrames(palette ? { ...look, palette: { ...look.palette, ...palette } } : look));
    this.player.frames = this.tintCache.get(key);
    this.tinted = Boolean(palette);
  }

  /** Takes the player to the front of a building's door in town, with a fade (e.g. from a search result). */
  travelTo(id) {
    const building = this.buildings.find((b) => b.id === id);
    if (!building) return false;
    this.run(this.travel(building));
    return true;
  }

  *travel(building) {
    yield* this.fadeTo(1);
    if (this.area !== this.town) this.hook('onLeave');
    if (this.tinted) this.tintPlayer(null);
    this.switchArea(this.town, building.door.x, building.door.y + 1, 'up');
    yield* this.fadeTo(0);
    this.page.announce(`In front of the ${building.name}. Walk up to go inside.`);
  }

  // The dialogs (and the chess rules) are only downloaded the first time someone reads about them.
  loadViewer(name) {
    if (!this.viewerModules[name]) {
      this.viewerModules[name] = VIEWERS[name].load();
      this.viewerModules[name].catch(() => {}); // a failure is reported when the visitor answers Yes
    }
    return this.viewerModules[name];
  }

  async showViewer(name, options, ctx, { fromScene = false } = {}) {
    const area = this.area;
    try {
      const module = await this.loadViewer(name);
      // Still downloading while the visitor moved on (read something again, or walked out): don't pop up over that.
      // A scene that opens a dialog as its last step is still running at that moment, so it doesn't count.
      if (this.area !== area || this.textbox.isOpen || (this.script && !fromScene)) return;
      this.viewers[name] ??= VIEWERS[name].make(module, () => this.page.canvas.focus({ preventScroll: true }));
      this.viewers[name].open(options, ctx);
    } catch (err) {
      console.error(err);
      // Browsers remember a failed download for the rest of the visit, so only a reload can try again.
      this.textbox.open('Sorry, this could not be loaded. Please reload the page to try again.');
    }
  }

  isReadable(thing) {
    return isReadable(thing);
  }

  startedMoving() {
    if (!this.hasMoved) {
      this.hasMoved = true;
      this.page.hideHint();
    }
  }

  // ---------------------------------------------------------------- tap / click to walk

  onTap({ x, y }) {
    const [vx, vy] = this.screen.toView(x, y);
    const wx = Math.floor(vx + this.camX);
    const wy = Math.floor(vy + this.camY);
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    this.startedMoving();
    // A building's picture can be taller than its footprint (like the pawn): tapping that part goes inside too.
    if (!this.area.objectAt(tx, ty)) {
      const building = this.area.objects
        .filter((o) => o.kind === 'building' && wx >= o.x && wy >= o.y && wx < o.x + o.sprite.width && wy < o.y + o.sprite.height)
        .sort((a, b) => b.sortY - a.sortY)
        .find((o) => isOpaque(o.sprite, wx - o.x, wy - o.y));
      if (building) {
        this.planRoute(building.door.x, building.door.y);
        return;
      }
    }
    this.planRoute(tx, ty);
  }

  planRoute(tx, ty) {
    const area = this.area;
    const reach = explore(area, this.player.target);
    const thing = area.objectAt(tx, ty);
    const warp = area.warpAt(tx, ty);
    const exit = area.exit;
    let goal = null;
    let final = null;
    if (thing?.kind === 'building' || warp?.type === 'door') {
      // tapping anywhere on a building walks to its door and goes in
      const building = thing?.kind === 'building' ? thing : warp.building;
      goal = [building.door.x, building.door.y + 1];
      final = { step: 'up' };
    } else if (thing?.kind === 'stairs') {
      // tapping a staircase walks to the tile in front of it and takes it
      goal = [thing.warp.x, thing.warp.y + 1];
      final = { step: thing.warp.dir };
    } else if (exit && tx === exit.x && (ty === exit.y || (ty > exit.y && area.isSolid(tx, ty)))) {
      goal = [exit.x, exit.y];
      final = { step: 'down' };
    } else if (isReadable(thing)) {
      // walk next to a sign (from whichever side is closest) and read it
      let best = null;
      for (const [ox, oy] of thing.tiles) {
        for (const side of SIDES) {
          const [dx, dy] = DIRS[side];
          const path = pathTo(reach, [ox - dx, oy - dy]);
          if (path && (!best || path.length < best.path.length)) best = { path, side };
        }
      }
      if (best) {
        this.setRoute(best.path, { face: best.side }, tx, ty);
        return;
      }
    } else if (!area.isSolid(tx, ty)) {
      goal = [tx, ty];
    }
    let path = goal && pathTo(reach, goal);
    if (!path) {
      final = null;
      const closest = nearest(reach, [tx, ty]);
      path = closest && pathTo(reach, closest);
    }
    if (path) this.setRoute(path, final, tx, ty);
  }

  setRoute(dirs, final, tx, ty) {
    this.route = { dirs, final };
    this.marker = { x: tx, y: ty, ticks: 40 };
  }

  followRoute() {
    const route = this.route;
    if (route.dirs.length > 0) {
      this.tryStep(route.dirs.shift());
      return;
    }
    this.route = null;
    if (route.final?.step) this.tryStep(route.final.step);
    else if (route.final?.face) {
      this.player.facing = route.final.face;
      this.interact();
    }
  }

  // ---------------------------------------------------------------- cutscenes (generator functions: each yield waits one tick)

  run(script) {
    this.route = null;
    this.startedMoving();
    if (this.script) {
      this.queued.push(script); // starts once the current one is over
      return;
    }
    this.script = script;
    this.stepScript();
  }

  stepScript() {
    if (this.script && this.script.next().done) this.script = this.queued.shift() ?? null;
  }

  // A room's message can be a function of the building's state.
  messageOf(area) {
    return toPages(this.call(area.name, 'message', area.message, this.context()));
  }

  *enter(warp) {
    const building = warp.building;
    const inside = this.interiors.get(building.id);
    const p = this.player;
    yield* this.animateDoor(building, 1);
    yield* this.walk('up');
    p.visible = false;
    yield* this.animateDoor(building, 0);
    yield* this.fadeTo(1);
    this.switchArea(inside, inside.spawn.x, inside.spawn.y, inside.spawn.facing);
    this.hook('onEnter');
    p.visible = true;
    yield* this.fadeTo(0);
    const message = this.messageOf(inside);
    if (message.length && !this.textbox.isOpen) this.textbox.open(message);
    else if (!message.length) this.page.announce(`Inside the ${building.name}. Walk down from the mat to go outside.`);
  }

  *leave(warp) {
    const building = warp.building;
    yield* this.fadeTo(1);
    this.hook('onLeave');
    if (this.tinted) this.tintPlayer(null);
    this.switchArea(this.town, building.door.x, building.door.y, 'down');
    this.page.announce(`Outside the ${building.name}.`);
    building.doorOpen = 1;
    yield* this.fadeTo(0);
    yield* this.walk('down');
    yield* this.animateDoor(building, 0);
  }

  // Stairs, like in the old games: walk onto them, fade to the other floor, and step off the staircase there.
  // Going up shows the upper room's message every time; coming back down doesn't repeat the ground floor's.
  *climb(warp) {
    yield* this.walk(warp.dir);
    yield* this.fadeTo(1);
    this.hook('onLeave');
    this.switchArea(warp.to, warp.at[0], warp.at[1], 'down');
    this.hook('onEnter');
    yield* this.fadeTo(0);
    yield* this.walk('down');
    const message = warp.goesUp ? this.messageOf(warp.to) : [];
    if (message.length && !this.textbox.isOpen) this.textbox.open(message);
    else if (!message.length) this.page.announce(`${warp.goesUp ? 'Upstairs' : 'Downstairs'}. The stairs are behind you.`);
  }

  *walk(dir) {
    const p = this.player;
    p.walk(dir, WALK_SPEED);
    while (!p.advance()) yield;
  }

  *animateDoor(building, target) {
    const start = building.doorOpen;
    for (let i = 1; i <= DOOR_TICKS; i++) {
      building.doorOpen = start + ((target - start) * i) / DOOR_TICKS;
      yield;
    }
  }

  *fadeTo(target) {
    if (this.reducedMotion.matches) {
      this.fade = target;
      return;
    }
    const start = this.fade;
    for (let i = 1; i <= FADE_TICKS; i++) {
      this.fade = start + ((target - start) * i) / FADE_TICKS;
      yield;
    }
  }

  switchArea(area, x, y, facing) {
    if (this.area) this.area.liveOverlay = null; // a scene's drawing never follows the player out
    this.area = area;
    this.player.placeAt(x, y, facing);
    this.route = null;
    this.marker = null;
  }

  // ---------------------------------------------------------------- drawing

  /**
   * The camera (top-left corner of the view, in pixels). Outside it is locked to the player, like in the
   * old games: always centred, so the world scrolls exactly one pixel for each pixel walked.
   */
  camera(width, height) {
    const p = this.player;
    const area = this.area;
    const x = p.px + TILE / 2 - width / 2;
    const y = p.py + TILE / 2 - height / 2;
    if (area.camera === 'room') {
      // Rooms: show the whole room when it fits (above the text box), otherwise follow the player but stay inside.
      return [Math.round(fitRoom(x, width, area.width * TILE, 0)), Math.round(fitRoom(y, height, area.height * TILE, this.textBoxReserve()))];
    }
    return [Math.round(x), Math.round(y)];
  }

  /** How many game pixels at the bottom of the screen the text box (and the touch controls) can cover. */
  textBoxReserve() {
    const cssPerPixel = this.screen.scale / this.screen.dpr;
    return 52 + (document.body.classList.contains('touch-ui') ? this.controlsHeight / cssPerPixel : 0);
  }

  render() {
    const { viewCtx: ctx, width, height } = this.screen;
    ctx.imageSmoothingEnabled = false;
    const area = this.area;
    const [camX, camY] = this.camera(width, height);
    this.camX = camX;
    this.camY = camY;
    const x0 = Math.floor(camX / TILE);
    const y0 = Math.floor(camY / TILE);
    const x1 = Math.floor((camX + width - 1) / TILE);
    const y1 = Math.floor((camY + height - 1) / TILE);
    const animate = !this.reducedMotion.matches;
    const tick = this.tick;

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) ctx.drawImage(this.tiles.get(area, tx, ty, tick, animate), tx * TILE - camX, ty * TILE - camY);
    }

    // Everything that stands up is drawn back to front, so things lower on screen cover things behind them.
    const sorted = [];
    for (const o of area.objects) {
      const right = o.bounds?.right ?? o.x + o.sprite.width;
      const bottom = o.bounds?.bottom ?? o.y + o.sprite.height;
      if (o.x - camX >= width || o.y - camY >= height || right <= camX || bottom <= camY) continue;
      if (o.layer === 'ground') drawObject(ctx, o, camX, camY, tick, animate);
      else sorted.push(o);
    }
    for (let ty = y0; ty <= y1 + 1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const makeSprite = area.tileAt(tx, ty).sprite;
        if (!makeSprite) continue;
        const sprite = makeSprite();
        sorted.push({ sprite, x: tx * TILE + Math.round((TILE - sprite.width) / 2), y: (ty + 1) * TILE - sprite.height, sortY: (ty + 1) * TILE, order: 0 });
      }
    }
    sorted.push(this.player);
    sorted.sort((a, b) => a.sortY - b.sortY || a.order - b.order);
    for (const o of sorted) drawObject(ctx, o, camX, camY, tick, animate);

    this.drawIndicators(ctx, camX, camY);
    this.drawOverlays(ctx, { camX, camY, width, height, tick, animate });
    if (this.showGrid) this.drawGrid(ctx, camX, camY, x0, y0, x1, y1);
    if (this.fade > 0) {
      ctx.globalAlpha = Math.ceil(this.fade * 8) / 8;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    this.screen.present();
  }

  // A room can draw on top of everything (its `overlay` hook), and so can a running scene (ctx.overlay).
  drawOverlays(g, view) {
    const area = this.area;
    if (area.hooks?.overlay) {
      try {
        area.hooks.overlay(this.context(), g, view);
      } catch (err) {
        delete area.hooks.overlay;
        console.error(`[town] ${area.name}: its "overlay" failed and was turned off: ${err.message}`);
      }
    }
    if (area.liveOverlay) {
      try {
        area.liveOverlay(g, view);
      } catch (err) {
        area.liveOverlay = null;
        console.error(`[town] ${area.name}: a scene's drawing failed: ${err.message}`);
      }
    }
  }

  drawIndicators(ctx, camX, camY) {
    const p = this.player;
    const blink = Math.floor(this.tick / 16) % 2 === 0;
    const exit = this.area.exit;
    // Standing on the exit mat: a small arrow says "walk down to leave".
    if (exit && !this.script && p.state === 'idle' && p.tx === exit.x && p.ty === exit.y && blink) {
      const x = exit.x * TILE - camX + 4;
      const y = (exit.y + 1) * TILE - camY + 1;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y + i, 8 - i * 2, 1);
    }
    if (this.marker && blink) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.marker.x * TILE - camX + 0.5, this.marker.y * TILE - camY + 0.5, TILE - 1, TILE - 1);
    }
  }

  // ?grid in the address bar shows tile coordinates: handy for placing buildings and signs.
  drawGrid(ctx, camX, camY, x0, y0, x1, y1) {
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const sx = tx * TILE - camX;
        const sy = ty * TILE - camY;
        if (this.area.isSolid(tx, ty)) {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.18)';
          ctx.fillRect(sx, sy, TILE, TILE);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(sx, sy, TILE, 1);
        ctx.fillRect(sx, sy, 1, TILE);
        if (this.area.inBounds(tx, ty)) {
          drawNumber(ctx, tx, sx + 2, sy + 2, '#ffffff');
          drawNumber(ctx, ty, sx + 2, sy + 9, '#ffe14a');
        }
      }
    }
  }
}

// Camera position along one axis for a room of `size` pixels on a screen `view` pixels long, where the
// last `reserve` pixels may be covered by the text box: centre the room in the space above it if it fits,
// otherwise keep the player in the middle of that space without scrolling past the room's edges.
function fitRoom(follow, view, size, reserve) {
  if (size + reserve <= view) return -Math.floor((view - reserve - size) / 2);
  return clamp(follow + reserve / 2, 0, size + reserve - view);
}

function drawObject(ctx, o, camX, camY, tick, animate) {
  if (o.draw) o.draw(ctx, camX, camY, tick, animate);
  else ctx.drawImage(o.sprite, o.x - camX, o.y - camY);
}

// Whether a picture has a visible pixel at (x, y). Reads through a tiny canvas of its own,
// so the sprites themselves stay fast to draw.
const probe = makeCanvas(1, 1).getContext('2d', { willReadFrequently: true });
function isOpaque(sprite, x, y) {
  probe.clearRect(0, 0, 1, 1);
  probe.drawImage(sprite, -x, -y);
  return probe.getImageData(0, 0, 1, 1).data[3] > 0;
}
