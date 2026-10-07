# My pixel-town portfolio

A personal website you explore like an old handheld RPG: walk a little character around a town and step into buildings.
Each building is a project or interest. Right now there are two: the **Chess House**, and **Técnico**
(my years at university, with my exchange semester in South Korea upstairs).

It is plain HTML, CSS and JavaScript: no build step, no libraries, about 180 KB in total (about 67 KB as GitHub Pages sends it, compressed),
and the chess viewer's 40 KB of that only downloads when someone reads about a game. All the art is drawn in code.

## Run it on your computer

Browsers refuse to run the game's JavaScript modules when you double-click `index.html`, so serve the folder instead. Pick one:

- **Python** (recommended): in a terminal in this folder run `python serve.py`, then open <http://localhost:8000>.
  It works like `python -m http.server 8000`, but it makes the browser check for changes on every reload, so your edits always show up.
- **VS Code**: install the *Live Server* extension, right-click `index.html`, then choose **Open with Live Server**.
- **Node.js**: run `npx serve`.

If a change doesn't show up after reloading, the browser is using an old copy of a file. Ctrl+Shift+R isn't enough, because the game
loads its buildings later, from code. Instead, open the developer tools (F12), right-click the reload button and choose
**Empty cache and hard reload**. With `python serve.py` you only ever need this once, for copies saved before you switched to it.

## Put it online (GitHub Pages)

1. On GitHub, create a **public** repository named `<your-username>.github.io`.
2. Upload everything in this folder to it, including the empty `.nojekyll` file. The one exception is `tests/node_modules`:
   `tests/` is an optional developer check, not part of the site, and once installed its `node_modules` holds thousands of files.
   With git, `.gitignore` already leaves those out:

   ```sh
   git init
   git add .
   git commit -m "My pixel town"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
   git push -u origin main
   ```

3. In the repository go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. After a minute or two the site is live at `https://<your-username>.github.io`.
   After later pushes, give it up to 10 minutes: GitHub Pages caches files.

Any other repository name works too. The site is then at `https://<your-username>.github.io/<repository>/`, because every path is relative.
File names are case-sensitive online (`Chess.js` is not `chess.js`), even though Windows doesn't care.

## Make it yours

| File | What to change |
| --- | --- |
| `src/world/site.js` | Your name, shown in the top-left corner. |
| `index.html` | `<title>` and the `description` meta tags: what search engines and link previews show. Once you know your address, make `og:image` a full URL such as `https://<your-username>.github.io/og-image.png`. |
| `src/world/player.js` | Your character's colours (hair, shirt, shoes). |
| `src/world/town.js` | The map, where visitors start and what the signs say. |
| `src/engine/constants.js` | `ZOOM_TILES`: how zoomed in the game is. 12 gives ×4 on a 1080p screen; lower is closer (10 = ×5), higher is further (15 = ×3). |

## Add a building

1. Copy `src/world/buildings/chess.js` (or `tecnico.js`, which has a second floor) to a new file, e.g. `src/world/buildings/music.js`,
   and edit it: give it a new `id` and `name`, a spot on the map (`at`), a `footprint`, a picture (`sprite`) and an `interior`.
2. Add its file name to the list in `src/world/buildings/index.js`:

   ```js
   export default ['chess.js', 'tecnico.js', 'music.js'];
   ```

3. Make room on the map in `src/world/town.js`: grass (`.`) where the building stands and a walkable tile below its door
   (a path `=` looks nice). Add `?grid` to the address (e.g. `http://localhost:8000/?grid`) to see every tile's column and row.

Buildings can be any size and shape: 5 × 3 tiles like Técnico, a small 3 × 3 house, an L-shape, open corners for the pawn's
narrow body like the Chess House... The **Buildings** table in
The four buildings in `src/world/buildings/` are good examples to copy: `chess.js` is the simplest.

If something is wrong, the browser console (F12) says what and where. That covers overlapping buildings, a blocked door,
a typo in a footprint or an unknown colour. If a building file has a JavaScript mistake (a missing comma, say), that one building
is left out and the console names the file and line; the rest of the town still works.

### Building fields

| Field | Meaning |
| --- | --- |
| `id` | A unique short name, e.g. `'music'`. |
| `name` | Its name, used for screen readers when you stand at its door. |
| `at` | `[column, row]` of the top-left tile of the footprint. |
| `footprint` | One string per row, one character per tile: `#` wall, `D` the door (exactly one, usually on the bottom row), `.` open ground you can walk behind. Use it to make L-shapes, towers, anything. |
| `sprite` | The picture (see below). It is centred on the footprint and stands on its bottom edge. It may be taller than the footprint, like the Chess House's pawn, or wider, like Técnico's cap. |
| `door` | Optional: `{ height: 24 }`, the door's height in pixels, used for the opening animation. |
| `sign` | Optional signpost: `{ text: 'Music Studio', at: [-1, 1] }`. `at` is relative to the door; this example is one tile left of it and one down. |
| `interior` | What is inside (see below). |
| `sprites`, `show` | Optional, instead of `sprite`: several pictures and a function that picks one, e.g. a lock that opens (see "Pictures that change or move"). |
| `state` | Optional: what the building remembers during a visit, e.g. `{ solved: false }` (see "Interactive rooms"). |

### Three ways to draw a building

Tiles are 16×16 pixels, so a footprint 5 tiles wide is 80 pixels wide.

1. **A PNG image.** Draw it in [Piskel](https://www.piskelapp.com/) (free, in the browser), Aseprite, LibreSprite or Pixelorama, save it in a new `assets/` folder, then:

   ```js
   sprite: { image: 'assets/music.png' },
   ```

   Keep the door on the bottom row of the picture, in the column of the `D` in the footprint. When the door opens, the game
   darkens a doorway one tile (16 px) wide and `door.height` px tall (24 by default), standing on the bottom edge of the picture.
   A picture wider or narrower than the footprint is centred on it, so shift the door by half the difference.
   For example, a 70 px picture on a 4-tile (64 px) footprint with the `D` in the second column has its door at x 19 to 34.
   The same applies to text pixel art.

2. **Text pixel art.** One character per pixel, with your own colours:

   ```js
   sprite: {
     pixels: [
       '..RRRR..',
       '.RRRRRR.',
       '.WWDDWW.',
       '.WWDDWW.',
     ],
     palette: { R: '#c84838', W: '#f0e0c0', D: '#5a3420' },
     outline: '#2e1a10', // optional: a 1-pixel dark outline (leave an empty pixel around your art)
   },
   ```

3. **Code.** Like the Chess House: `sprite: { width: 80, height: 108, draw(p, { door }) { ... } }`.
   `p` is a painter with `rect`, `px`, `hline`, `vline`, `box`, `checker`, `ellipse`, `profile` (round symmetric shapes such as chess pieces or vases),
   `rows` (stamp text pixel art), `image` and `outline`. `door` says where the door must be drawn so the opening animation lines up.

### Interiors

```js
interior: {
  size: [9, 7],          // columns, rows; the top two rows are the back wall
  floor: 'wood',         // or 'checker' or 'ondol' (a warm Korean paper floor)
  message: ['Shown when someone walks in.', 'A second page.'],
  decor: [
    { type: 'plant', at: [0, 2] },
    { at: [3, 4], size: [3, 1], sprite: { /* any of the three formats */ }, text: ['Shown when someone walks into it,', 'or presses A in front of it.'] },
  ],
},
```

Coordinates inside are counted from the room's top-left corner. The exit mat is in the middle of the bottom row.
For a room of any shape, give `map` (rows of tile characters, see below) and `exit: [column, row]` instead of `size` and `floor`.

Each page of text is shown on its own, so make each one a whole sentence (or two) that makes sense alone, and never split a
sentence across two pages. Keep it to two lines: at most 68 characters. Use straight quotes (`'`), because the pixel font has no
curly ones. In code, write a page containing `'` between double quotes: `"I'm still around 2000!"`.
Accented letters such as é, ã and ç are fine.

A decoration's `offset: [x, y]` nudges its picture by that many pixels (negative `y` is up), e.g. to hang a picture higher on the wall.
Its `solid: false` lets the player walk over it, like a rug or a cushion. A decoration on the back wall is read from the tile below it.

#### A second floor

Give an interior an `upstairs` room and the building gets two floors, joined by stairs. Visitors walk into the stairs to take them,
like in the old games. The upstairs room has the same fields as an interior (`size`, `floor`, `message`, `decor`) but no exit mat:
the stairs are its way out. Its `message` shows every time someone comes up. Técnico works like this:

```js
interior: {
  size: [11, 9],
  floor: 'wood',
  message: ['Welcome!'],
  decor: [/* ... */],
  upstairs: {
    size: [11, 8],
    floor: 'ondol',
    message: ['Upstairs: my exchange semester in South Korea!'],
    decor: [/* ... */],
  },
},
```

The stairs stand against the back wall in the top-right corner of both rooms, 1 tile wide and 2 tall. To move them, give either room
`stairs: [column, 0]`. Keep the tile in front of them free (the console warns if something blocks it).

#### A chess game visitors can replay

Give a decoration a `game` and, after its text, visitors are asked "Do you want to see the game?" (YES / NO).
"Yes" opens a board where they can step through the moves. The Chess House table works like this:

```js
{
  at: [3, 4], size: [3, 1], sprite: { /* ... */ },
  text: ["It's not my best game, but it's my favourite from my tournaments."],
  game: {
    pgn: FAVOURITE_GAME,       // the game in PGN, e.g. copied from chess.com ("Share" -> "PGN")
    orientation: 'black',      // which side is at the bottom of the board: 'white' (default) or 'black'
    title: 'My favourite game', // optional: the heading (default: "White vs Black")
    ask: 'Do you want to see the game?', // optional: the question
  },
},
```

The players, ratings, date, round and result come from the PGN's `[Tags]`, and a `[Link "..."]` tag adds an "Open on chess.com" link.
A `{comment}` after a move in the PGN is shown with that move (beside the board, or under it on phones) when the viewer reaches it.

#### A game against Stockfish

`ctx.show('battle', options)` opens a board where the visitor plays the chess engine Stockfish (the Chess House's boss does
this; see the end of `chess.js`). Stockfish lives in `vendor/stockfish/` (1.8 MB, GPL-3.0, see `CREDITS.md`) and is only
downloaded when someone accepts a game; `ctx.preload('battle')` starts the download early, e.g. while the boss is talking.

```js
ctx.show('battle', {
  elo: 2000,                  // how strong Stockfish plays (1320 to 3190)
  color: 'w',                 // the visitor's pieces: 'w' or 'b'
  resume: false,              // true: carry on with the last unfinished game, if there is one
  title: 'Stockfish, about 2000',
  onClose: (ctx, result) => {}, // 'won', 'lost', 'draw', 'resigned', 'unfinished' or 'unstarted'
});
```

#### Questions, links and actions

A decoration can do more than talk. After its `text`, it can:

- **ask a question** with `ask: { question, choices, answers }`. `choices` default to `['Yes', 'No']`, and B (or X / Escape)
  picks the last one, like "No" in the old games. Each answer is pages to show, another question (to chain them, e.g. three
  quiz rounds), or a function `(ctx) => ...` returning either (or nothing). A question can start with pages of its own (`text`).
  Keep answers short (about 20 characters, at most 3 or 4 of them) so they fit on phones.

  ```js
  ask: {
    question: 'Which version?',
    choices: ['v1', 'v2'],
    answers: [['Clunk! A plain biscuit.'], (ctx) => (ctx.state.sprinkles = true, ['Clunk! Sprinkles!'])],
  },
  ```

- **offer a link** with `link: { url, label, ask }`: "Do you want to open it?" (or your `ask`), then Yes shows a small card
  with the real link, which the visitor clicks (games can't open tabs by themselves without being blocked as pop-ups).
- **do something every time it is read** with `use: (ctx) => pages`, e.g. pick up a brush. It can return pages to show.
- **offer an ARC puzzle** with `arc: { task, title, ask, onSolve }` (see "An ARC puzzle visitors can solve").

`text` itself can also be a function, `(ctx) => pages`, to say different things as the room changes. Give a decoration a
`label` (e.g. `'the paper desk'`) and the console names it if something about it goes wrong.

#### An ARC puzzle visitors can solve

Give a decoration an `arc` and, after its text, visitors are asked "Do you want to try the puzzle?". "Yes" opens a sheet with the
example grids and an empty answer grid they paint with ARC's ten colours (a tap or click paints a cell; with the keyboard, the arrows
move and Enter, Space or a digit paints), then check. "See it as the model does" shows the grid as one long line, the way a language
model reads it, with the chosen square's neighbours lit in both. Only an exact answer counts, as in ARC.

```js
{
  at: [4, 4], size: [3, 1], sprite: { /* ... */ },
  text: ['An ARC puzzle: find the rule!'],
  arc: {
    title: 'Join the matching ends',
    intro: 'Optional: one sentence above the examples.',
    task: {
      // ARC's own JSON works too ({ input: [[2, 0, 1], ...] }); rows of digits are easier to read.
      train: [{ input: ['20010', '00000', '20030'], output: ['20010', '20000', '20030'] }],
      test: [{ input: ['30020', '00000', '30010'], output: ['30020', '30000', '30010'] }],
    },
    ask: 'Do you want to try the puzzle?', // optional
    solvedText: 'Solved!',                    // optional: what the sheet says when the answer is right
    onSolve: (ctx) => { ctx.state.solved = true; }, // optional: called once the sheet closes after a right answer
    onClose: (ctx, solved) => {},                   // optional: called whenever the sheet closes, solved or not
  },
},
```

Keep puzzles small (up to about 7 x 7) so the answer fits a phone. Write your own puzzles, or use a real ARC task: those are
Apache-2.0, so credit them in `CREDITS.md`. The sheet is only downloaded the first time someone reads about a puzzle.
A room can also open a sheet itself with `ctx.show('arc', { task, title, intro, solvedText, onSolve, onClose })`: the ARC-AGI
building does, so visitors try the floor puzzle before its robot does.

#### Characters

`npc: { facing, palette, frames, turns }` makes a decoration a character, who stands a few pixels up their tile like the
player and turns to face whoever talks to them. Without `frames` it borrows the player's look from `player.js`, recoloured
with `palette` (e.g. `{ H: '#3e3648', C: '#e05050' }` for hair and shirt). With `frames` (`down`, and optionally `up` and
`left`; `right` is `left` mirrored) it can be anyone or anything, like a dog. `turns: 'sideways'` only turns left or right,
`false` never turns. Give it `text` (or `ask`) like any decoration.

```js
{ at: [2, 4], npc: { facing: 'right', palette: { H: '#3e3648', C: '#5a84e0' } }, text: "Hi! I'm a student annotator!" },
```

#### Pictures that change or move

- **Animation:** a picture drawn in code can have `frames` (how many) and `frameTicks` (how long each shows; 60 ticks are a second).
  `draw` gets `info.frame`: 0, 1, 2... Keep `frameTicks` at 30 or more (at most two changes a second), and set `still` to the frame
  shown to visitors who prefer reduced motion (frame 0 by default). It works for buildings and decorations alike:
  `sprite: { width: 80, height: 100, frames: 4, frameTicks: 60, draw: drawCabinet }`.
- **Pictures that follow the state:** `sprites: { closed: {...}, open: {...} }` plus `show: (state) => (state.open ? 'open' : 'closed')`.
  Every picture is drawn once when the town loads, and `show` picks one each frame. For a building, draw them all the same size, with
  the door in the same place (`draw` gets `info.state`, the picture's name). A building's `show` also gets the building, so a key can
  look pressed while its door is open: `show: (state, building) => (building.doorOpen > 0 ? 'pressed' : 'up')`.

#### A room's own tiles

`tiles: { g: { name: 'graphite floor', draw(p, { variant, mask, frame }) { ... }, variants: 2, edges: isWall } }` adds tiles that only
this building's rooms use (upstairs gets them too), so `floor: 'g'` or a custom `map` can use them. Fields, as in `src/engine/tiles.js`:
`solid` (blocks the way), `variants` (random-looking versions), `edges` (which neighbouring tiles count as different: `isWall` gives
the back wall's shadow, with `floorShadow(p, mask)` from `tiles.js`), `frames` and `frameTicks` (animation), and `sprite` (a tall
picture standing on the tile, like the trees). Use single characters that aren't taken by the built-in tiles (see "Map tiles").

#### Interactive rooms

A room (an `interior`, or its `upstairs`) can react to the visitor with these optional functions, called **hooks**:

| Hook | When |
| --- | --- |
| `onEnter(ctx)` | The visitor arrives (through the door or the stairs), before the screen fades in. Set the room up here; don't talk. |
| `onLeave(ctx)` | The visitor leaves (through the mat or the stairs). |
| `onStep(ctx, x, y)` | The visitor finishes a step onto tile (x, y). |
| `onUse(ctx, x, y)` | The visitor presses A facing tile (x, y), and nothing readable is there. |
| `onTouch(ctx, x, y)` | The visitor walks into tile (x, y), which blocks the way and has nothing readable (once per key press). |
| `update(ctx)` | Every tick (60 a second) while the visitor walks around freely. |
| `overlay(ctx, g, view)` | After everything is drawn: draw on top with `g` (a canvas context), using `view.camX`/`camY` to place things. |

Every function a building gives the game (hooks, `use`, `text` and `ask` functions, answers, `show`) gets **`ctx`**:

- `ctx.state`: the building's memory for the visit (its `state` field), shared by both floors. `ctx.area`, `ctx.building`, `ctx.thing` (the decoration being read), `ctx.player` (`{ x, y, facing }`) and `ctx.tick`.
- `ctx.say(pages)` shows text. `ctx.ask({ question, choices, answers })` asks a question. `ctx.announce(text)` tells screen readers only.
- `ctx.tileAt(x, y)`, `ctx.setTile(x, y, '4')` and `ctx.resetTiles()` read and change the room's tiles (solid tiles block straight away).
  `ctx.objectAt(x, y)`, `ctx.remove(object)` and `ctx.setSolid(object, false)` do the same for decorations.
- `ctx.tint({ C: '#FF4136', c: '#b02a20' })` recolours the player's clothes (e.g. to show the paint they carry); `ctx.tint(null)` undoes it.
  Leaving the building undoes it too.
- `ctx.run(function* (ctx) { ... })` plays a **scene**: each `yield` waits one tick (60 a second), and the scene pauses while text is
  showing, so `ctx.say(pages); yield;` waits for the visitor to read it. Inside a scene: `yield* ctx.wait(30)`, `yield* ctx.walk('up')`
  (it walks even into solid tiles, so check first), `yield* ctx.fade(1)` and back with `yield* ctx.fade(0)`, `ctx.face('left')`,
  `const i = yield* ctx.choose('Ready?', ['Yes', 'No'])` (gives the answer's number), and `ctx.overlay((g, view) => { ... })` to draw
  on top of the room while the scene plays (`ctx.overlay(null)` stops it; leaving the room always stops it).
  The visitor can't walk while a scene plays, so keep scenes short, skip or shorten their motion when `ctx.reducedMotion` is true,
  and never draw text on the canvas: the words go in the text box.
- `ctx.openLink(url, label)` shows the link card; `ctx.travel('chess')` takes the visitor (with a fade) to the front of another building's door.
- `ctx.show('arc', options)` opens an ARC puzzle sheet and `ctx.show('battle', options)` a game against Stockfish (see above);
  either can be the last step of a scene. `ctx.preload(name)` downloads one in advance.

Rules that keep every room usable: the exit mat, the stairs and everything readable must always be reachable (a puzzle can add
things, never lock them away); a room must still make sense to someone who only reads; tell screen readers what changes
(`ctx.announce`); and keep randomness out (use `hash` from `pixels.js` if something should look random), so every visit is the same.
If one of these functions makes a mistake, the console says which building and hook, that hook is turned off, and the game carries on.

## Start in front of a building

Add `?start=` and a building's `id` to the address, e.g. <http://localhost:8000/?start=arc>, to start in front of its door.
Handy while working on one building.

## Map tiles

| Town | | Inside | |
| --- | --- | --- | --- |
| `.` | grass | `W` | back wall, top half |
| `*` | flowers | `w` | back wall, bottom half |
| `=` | path | `_` | wooden floor |
| `~` | water (blocked) | `x` | chessboard floor |
| `T` | tree (blocked) | `o` | ondol floor (Korean, warm paper) |
| `b` | bush (blocked) | `k` | stone paving (e.g. a kerb around an ARC floor) |
| `F` | fence (blocked) | `c` | arcade carpet (`floor: 'arcade'`) |
| | | `0`-`9` | ARC grid cells in ARC's ten colours (0 black, 1 blue, 2 red, 3 green, 4 yellow, 5 grey, 6 magenta, 7 orange, 8 light blue, 9 maroon) |
| | | ` ` (space) | nothing (blocked) |

New tile types can be added in `src/engine/tiles.js`.

## Controls

- **Keyboard**: arrow keys or WASD to walk (a quick tap just turns), hold Shift or X to run, Enter or Space (or Z) to read signs and turn pages.
  Walking into a sign or a table reads it too, and walking into stairs takes them. In a YES / NO question, up and down move the cursor,
  Enter answers and X / Escape means "no" (or click / tap an answer).
- **Mouse or touch**: click or tap where you want to go; click or tap a building to walk in, stairs to take them, or a sign or table to read it.
- **Phones**: a D-pad and A / B buttons appear at the bottom.
- **Chess games**: the left and right arrow keys step through the moves (Home / End jump to the start or the end), or use the buttons and the move list.
  Escape or "Back to the room" closes the board (on phones there is also an X in the top corner).

## How it works

- `src/world/`: your content (the only folder you normally edit).
- `tests/`: optional automated checks (`cd tests`, `npm install` once, then `npm test`). First `chess.test.mjs` checks the
  chess rules (about 20 seconds); then `smoke.mjs` opens the site in Chrome, walks into every building (and up its stairs)
  at desktop and phone sizes, and complains about any error. If the first part fails, the second doesn't run. The site does not need them.
- `src/engine/`: the engine.
  - `game.js`: the main loop, movement rules, the door, stairs and fade cutscenes, the camera and drawing.
  - `world.js`: turns your content into maps and checks it for mistakes.
  - `tiles.js`: the tile artwork.
  - `input.js`: keyboard, touch and the D-pad.
  - `textbox.js`: the text box, including YES / NO questions.
  - `pixels.js`: pixel-art helpers.
  - `screen.js`: crisp whole-number scaling on any screen.
  - `chessviewer.js`, `chess.js`, `chesspieces.js`: the chess game viewer, the chess rules that read a PGN,
    and the pixel-art pieces. They're only downloaded once someone reads about a game, so "Yes" opens it at once.
- The game runs at a fixed 60 ticks per second. Walking takes 16 ticks per tile, turning on the spot 8, and bumping into a wall 32, with doors and fades timed like the Game Boy Advance classics.
- The text box is real HTML, so the text is sharp at any zoom and readable by screen readers and search engines.

## Credits and licenses

- All artwork is original and drawn in code. No sprites, music, fonts or names from Nintendo or Pokémon games are used.
  Keep it that way: they actively take down fan projects that use their assets.
- Font: [m5x7](https://managore.itch.io/m5x7) by Daniel Linssen, CC0 (public domain). See `CREDITS.md`.
