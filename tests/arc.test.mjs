// Checks the ARC grid helpers in src/engine/arc.js (used by the ARC puzzle sheet, the ARC floor tiles and the ARC building).
//
//   cd tests
//   node arc.test.mjs
//
// Prints a short summary and exits with code 1 if anything is wrong.

import { ARC_COLORS, ARC_NAMES, copyGrid, describeGrid, flatten, paintGrid, readGrid, readTask, sameGrid } from '../src/engine/arc.js';

let passed = 0;
const failures = [];
const check = (ok, what) => (ok ? passed++ : failures.push(what), ok);
const same = (actual, expected, what) => check(JSON.stringify(actual) === JSON.stringify(expected), `${what}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
function throws(run, pattern, what) {
  try {
    run();
  } catch (error) {
    return check(pattern.test(error.message), `${what}: wrong error "${error.message}"`);
  }
  return check(false, `${what}: no error was thrown`);
}

// The palette: ten colours with names, in ARC's order (0 black ... 9 maroon), as in the 2019 viewer.
same(ARC_COLORS.length, 10, 'ten colours');
same(ARC_NAMES.length, 10, 'ten names');
same([ARC_COLORS[0], ARC_COLORS[1], ARC_COLORS[9]], ['#000000', '#0074D9', '#870C25'], 'black, blue and maroon');

// Reading grids: rows of digits and ARC's own arrays of numbers mean the same thing.
same(readGrid(['012', '340']), [[0, 1, 2], [3, 4, 0]], 'rows of digits');
same(readGrid([[0, 1, 2], [3, 4, 0]]), [[0, 1, 2], [3, 4, 0]], "ARC's arrays");
throws(() => readGrid([]), /at least one row/, 'an empty grid');
throws(() => readGrid(['012', '34']), /row 1 has 2 cells, but row 0 has 3/, 'rows of different lengths');
throws(() => readGrid([[0, 10]]), /not a colour from 0 to 9/, 'a colour above 9');
throws(() => readGrid([['a']]), /not a colour from 0 to 9/, 'a letter');
throws(() => readGrid([Array(31).fill(0)]), /1 to 30 cells/, 'a row of 31 cells');
throws(() => readGrid(Array.from({ length: 31 }, () => '0')), /1 to 30 cells/, '31 rows');
check(readGrid(Array.from({ length: 30 }, () => '0'.repeat(30))).length === 30, 'a 30 x 30 grid is fine');

// Reading tasks.
const task = readTask({ train: [{ input: ['10', '00'], output: ['11', '00'] }], test: [{ input: ['20'], output: ['22'] }] });
same(task.test[0].output, [[2, 2]], 'a task');
throws(() => readTask({ train: [] }), /needs "train"/, 'a task with no test');
throws(() => readTask({ train: [{ input: ['1'], output: ['12', '3'] }], test: [{ input: ['1'], output: ['1'] }] }), /example 1 output: row 1/, 'a broken example names itself');

// Comparing, copying and flattening.
check(sameGrid([[1, 2], [3, 4]], [[1, 2], [3, 4]]), 'equal grids');
check(!sameGrid([[1, 2], [3, 4]], [[1, 2], [3, 5]]), 'one cell differs');
check(!sameGrid([[1, 2]], [[1, 2], [3, 4]]), 'different sizes');
const original = [[1, 2], [3, 4]];
const copy = copyGrid(original);
copy[0][0] = 9;
check(original[0][0] === 1, 'a copy is separate');
same(flatten([[1, 2, 3], [4, 5, 6]]), [1, 2, 3, 4, 5, 6], 'reading order: row by row, like a language model');

// Words for screen readers.
same(describeGrid([[0, 2], [1, 0]]), '2 by 2. Row 1: black, red. Row 2: blue, black.', 'a grid in words');

// Drawing: a 2 x 1 grid with 3 px cells and a 1 px line is 9 x 5 pixels, one rectangle for the lines and one per cell.
const rects = [];
const ctx = { fillStyle: '', fillRect: (...args) => rects.push([ctx.fillStyle, ...args]) };
same(paintGrid(ctx, ['12'], 10, 20, { cell: 3, gap: 1, line: '#555555' }), { width: 9, height: 5 }, 'the size it takes');
same(rects, [['#555555', 10, 20, 9, 5], ['#0074D9', 11, 21, 3, 3], ['#FF4136', 15, 21, 3, 3]], 'what it draws');

if (failures.length) {
  console.error(`arc.test.mjs: ${failures.length} problem(s):\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`ok   arc grids    ${passed} checks passed`);
