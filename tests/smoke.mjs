// Optional automated check (the website itself does not need any of this).
// It serves the site, opens it in headless Chrome as a desktop and as a phone, walks into every
// building (and up its stairs, if it has an upstairs), reads everything, answers every question with its
// first answer, opens and closes every dialog, walks back out, and fails on any console error, warning or 404.
// It also checks a buildings table in a local notes file, if there is one (see the end of this file).
//
//   cd tests
//   npm install            (once: installs puppeteer-core, which drives the Chrome already on this PC, and chess.js for chess.test.mjs)
//   npm test               (runs chess.test.mjs and arc.test.mjs, then this file)
//   npm run update-docs    (only this file, but it rewrites that buildings table instead of complaining)
//
// Screenshots are saved in tests/screenshots/. Set CHROME_PATH if Chrome is installed elsewhere.

import { createServer } from 'node:http';
import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS = join(ROOT, 'tests', 'screenshots');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
};
const DEVICES = [
  { name: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'phone', viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
];

// A tiny static file server. Like GitHub Pages it treats upper/lower case as different,
// which Windows does not, so a wrongly-cased path fails here instead of only after publishing.
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = normalize(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
  if (!file.startsWith(normalize(ROOT))) return res.writeHead(403).end();
  try {
    if ((await realpath(file)) !== file) throw new Error('wrong upper/lower case');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
await mkdir(SHOTS, { recursive: true });

const problems = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// One page at a time: only the page in front of a browser gets animation frames, which the game loop runs on.
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
let dimensions = null; // one row per building, for the notes' table

/** Opens the site on a device and returns a small toolkit for checking buildings on it. */
async function open(device, query, prefix) {
  const page = await browser.newPage();
  const report = (text) => problems.push(`[${prefix}] ${text}`);
  page.on('console', (m) => ['error', 'warn', 'warning'].includes(m.type()) && report(`console ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => report(`page error: ${e.message}`));
  page.on('response', (r) => r.status() >= 400 && report(`HTTP ${r.status()} for ${r.url()}`));
  await page.setViewport(device.viewport);
  await page.goto(`${url}${query}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.game?.player, { timeout: 15000 });
  await sleep(300);
  const shot = (name) => page.screenshot({ path: join(SHOTS, `${prefix}-${name}.png`) });
  return { page, report, shot, device };
}

/** Everything a visitor can read in one building, upstairs included, then back out to the town. */
async function visitBuilding({ page, report, shot }, id) {
  // Waits until the game is idle: presses Enter through text (the first answer of every question),
  // waits for scenes to end, and closes any dialog a "Yes" opened (after checking it).
  const settle = async (room) => {
    for (let i = 0; i < 500; i++) {
      const s = await page.evaluate(() => ({
        text: game.textbox.isOpen,
        script: Boolean(game.script),
        dialog: document.querySelector('dialog[open]')?.className ?? null,
      }));
      if (s.dialog) {
        await checkDialog(room, s.dialog);
        continue;
      }
      if (s.text) {
        await page.keyboard.press('Enter');
        await sleep(50);
        continue;
      }
      if (s.script) {
        await sleep(50);
        continue;
      }
      return true;
    }
    report(`${room} never went quiet: text, a scene or a dialog kept going (a question that loops?)`);
    return false;
  };

  const dialogs = new Map(); // one screenshot per kind of dialog
  const checkDialog = async (room, kind) => {
    if (kind.includes('battle')) {
      // A game against Stockfish: play e4 (the smoke test always picks White) and wait for its answer.
      await page.waitForFunction(() => /your move/i.test(document.querySelector('.battle .viewer__status').textContent), { timeout: 10000 }).catch(() => {});
      for (const square of ['e2', 'e4']) {
        await page.evaluate((sq) => [...document.querySelectorAll('.battle__squares button')].find((b) => b.getAttribute('aria-label').startsWith(`${sq},`))?.click(), square);
      }
      const answered = await page
        .waitForFunction(() => /Stockfish played/.test(document.querySelector('.battle .viewer__status').textContent), { timeout: 30000 })
        .then(() => true, () => false);
      const status = await page.evaluate(() => document.querySelector('.battle .viewer__status').textContent);
      if (!answered) report(`Stockfish did not answer 1. e4 in ${room} (the status says "${status}")`);
    } else if (kind.includes('viewer')) {
      await page.keyboard.press('End');
      await sleep(300);
      const status = await page.evaluate(() => document.querySelector('.viewer__status').textContent);
      if (!/^\d+\.(\.\.)? \S+/.test(status)) report(`the chess viewer in ${room} shows "${status}" after jumping to the last move`);
    }
    if (kind.includes('link-card')) {
      const href = await page.evaluate(() => document.querySelector('dialog.link-card a')?.href ?? '');
      if (!/^https?:\/\//.test(href)) report(`the link card in ${room} has no web link (${JSON.stringify(href)})`);
    }
    const name = kind.includes('battle') ? 'battle' : kind.split(' ').find((c) => c !== 'sheet') ?? 'dialog';
    dialogs.set(name, (dialogs.get(name) ?? 0) + 1);
    if (dialogs.get(name) === 1) await shot(`${id}-${name}`);
    await page.keyboard.press('Escape');
    const closed = await page
      .waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 5000 })
      .then(() => true, () => false);
    if (!closed) {
      report(`a dialog (${kind}) in ${room} did not close with Escape`);
      await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    }
    await sleep(150); // the dialog's "close" event, which gives the focus back to the game, comes a moment later
    const focus = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    if (focus !== 'screen' && focus !== 'BODY') report(`after closing a dialog in ${room}, the focus is on ${focus} instead of the game`);
  };

  // The room's message should be showing as the player arrives: check its first page, take a screenshot, read to the end.
  const checkMessage = async (room, name) => {
    const message = await page.evaluate(() => (typeof game.area.message === 'function' ? game.messageOf(game.area) : game.area.message));
    if (message?.length) {
      const shown = await page.evaluate(() => (game.textbox.isOpen ? game.textbox.text : null));
      if (shown !== message[0]) report(`${room} should say "${message[0]}" but the text box shows ${JSON.stringify(shown)}`);
      await sleep(400);
    }
    await shot(name);
    await settle(room);
  };

  // Read every decoration and character in the room that has something to say.
  const readEverything = async (room) => {
    const areaId = await page.evaluate(() => game.area.id);
    const readables = await page.evaluate(() =>
      game.area.objects.filter((o) => game.isReadable(o)).map((o) => ({ at: o.tiles[0], label: o.label })),
    );
    for (const readable of readables) {
      await page.evaluate(([x, y]) => game.planRoute(x, y), readable.at);
      const started = await page
        .waitForFunction(() => game.textbox.isOpen || game.script || document.querySelector('dialog[open]'), { timeout: 15000 })
        .then(() => true, () => false);
      if (!started) report(`walking to ${readable.label} at (${readable.at}) in ${room} did not show anything`);
      await settle(room);
      const now = await page.evaluate(() => game.area.id);
      if (now !== areaId) {
        report(`reading ${readable.label} in ${room} took the player out of the room (to ${now})`);
        return false;
      }
    }
    return true;
  };

  // Take the room's stairs exactly like a tap on them would.
  const takeStairs = async (to) => {
    await page.evaluate(() => game.planRoute(game.area.stairs.x, game.area.stairs.y));
    return page.waitForFunction((to) => game.area.id === to && !game.script, { timeout: 30000 }, to).then(() => true, () => false);
  };

  // Walk to the door exactly like a tap on it would, and go in.
  await settle('the town');
  await page.evaluate((id) => {
    const b = game.buildings.find((x) => x.id === id);
    game.planRoute(b.door.x, b.door.y);
  }, id);
  const inside = await page.waitForFunction((id) => game.area.id === `inside-${id}` && !game.script, { timeout: 30000 }, id).then(() => true, () => false);
  if (!inside) {
    report(`could not walk into "${id}"`);
    return;
  }
  await checkMessage(`"${id}"`, `inside-${id}`);
  if (!(await readEverything(`"${id}"`))) return;
  // A second floor: go up, check and read everything there too, and come back down.
  if (await page.evaluate(() => Boolean(game.area.stairs))) {
    if (await takeStairs(`inside-${id}-upstairs`)) {
      await checkMessage(`"${id}" upstairs`, `upstairs-${id}`);
      if (!(await readEverything(`"${id}" upstairs`))) return;
      if (!(await takeStairs(`inside-${id}`))) report(`could not walk down the stairs in "${id}"`);
      await settle(`"${id}"`);
    } else {
      report(`could not walk up the stairs in "${id}"`);
    }
  }
  // Walk back out through the exit mat.
  await page.evaluate(() => {
    const exit = game.area.exit;
    game.planRoute(exit.x, exit.y + 1);
  });
  const out = await page.waitForFunction(() => game.area.id === 'town' && !game.script, { timeout: 30000 }).then(() => true, () => false);
  if (!out) report(`could not walk out of "${id}"`);
}

try {
  for (const device of DEVICES) {
    const tools = await open(device, '', device.name);
    const { page, report, shot } = tools;
    await shot('town');
    const buildings = await page.evaluate(() => game.buildings.map((b) => b.id));
    dimensions ??= await page.evaluate(() =>
      game.buildings.map((b) => {
        const inside = game.interiors.get(b.id);
        // A building with an upstairs has two rooms: "11 × 9 + 11 × 8".
        const rooms = inside ? [inside, inside.stairs?.to].filter(Boolean).map((room) => `${room.width} × ${room.height}`).join(' + ') : '-';
        return [b.name, b.file, `${b.size[0]} × ${b.size[1]}`, `${b.sprite.width} × ${b.sprite.height}`, `[${b.def.at.join(', ')}]`, `(${b.door.x}, ${b.door.y})`, rooms];
      }),
    );
    for (const id of buildings) await visitBuilding(tools, id);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

// A notes file kept next to the site (any .md file in the root with the two markers below) can hold a table of
// the buildings; it must match the buildings in the game. Files without the markers are left alone.
if (dimensions) {
  const [start, end] = ['<!-- buildings:start -->', '<!-- buildings:end -->'];
  const table = [
    '| Building | File | Footprint (tiles) | Picture (px) | At (column, row) | Door tile | Inside (tiles) |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...dimensions.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
  for (const name of (await readdir(ROOT)).filter((file) => file.endsWith('.md'))) {
    const docsFile = join(ROOT, name);
    const docs = (await readFile(docsFile, 'utf8')).replace(/\r\n/g, '\n');
    const from = docs.indexOf(start);
    const to = docs.indexOf(end);
    if (from < 0 || to < 0 || docs.slice(from + start.length, to).trim() === table) continue;
    if (process.argv.includes('--update-docs')) {
      await writeFile(docsFile, `${docs.slice(0, from + start.length)}\n${table}\n${docs.slice(to)}`);
      console.log(`Updated the buildings table in ${name}.`);
    } else {
      problems.push(`the buildings table in ${name} is out of date (run "npm run update-docs"). It should be:\n${table}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`All good: every building can be entered and left on ${DEVICES.map((d) => d.name).join(' and ')}. Screenshots are in tests${sep}screenshots.`);
