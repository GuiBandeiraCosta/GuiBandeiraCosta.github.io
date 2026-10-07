import { Game } from './engine/game.js';
import { setupPage } from './engine/page.js';

// The page is set up first and the content is loaded afterwards with import(), so a mistake in a
// content file shows a message (or leaves out one building) instead of leaving a blank page.
const page = setupPage();

async function main() {
  const [site, town, player, list] = await Promise.all(['site.js', 'town.js', 'player.js', 'buildings/index.js'].map((file) => import(`./world/${file}`)));
  const loaded = await Promise.allSettled(list.default.map((file) => import(`./world/buildings/${file}`)));
  const buildings = [];
  loaded.forEach((result, i) => {
    if (result.status === 'fulfilled') buildings.push({ ...result.value.default, file: list.default[i] });
    else console.error(`[town] src/world/buildings/${list.default[i]} has a mistake, so that building was left out: ${result.reason?.message ?? result.reason}`);
  });

  page.showContent({ site: site.default, buildings });
  const game = new Game({ page, town: town.default, buildings, player: player.default });
  window.game = game; // handy for poking around in the browser console
  await game.load();
  game.start();
}

main().catch((err) => {
  console.error(err);
  page.showError(`The town could not load: ${err.message}. The browser console (F12) says which file and line.`);
});
