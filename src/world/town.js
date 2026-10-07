// The town map. One character per tile (16x16 pixels); every row must be the same length.
//
//   .  grass          *  flowers         =  path           ~  water (blocked)
//   T  tree (blocked) b  bush (blocked)  F  fence (blocked)
//
// Buildings are not drawn here: each one is placed by its own file in buildings/ ("at").
// Leave grass where a building goes. Outside the map there is endless forest.
// Tip: open the site with ?grid at the end of the address to see the column and row numbers.

export default {
  // Columns 15 and up were added on 2026-10-06 for two more lots (buildings/neuralshift.js and arc.js): NeuralShift's at
  // [15, 5] and ARC-AGI's at [21, 5], with a little square (row 8) between their doors. The pond moved below
  // the road. Columns 0-14 are unchanged, so every older position still holds.
  map: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 0
    'TTTT..TTT...........T.....TTTT', // 1
    'TT..........................TT', // 2
    'T............................T', // 3
    'T..........................*.T', // 4
    'T............................T', // 5
    'T............................T', // 6
    'T...=......=.....=.....=.....T', // 7
    'T...=...*..=.*...=======.....T', // 8
    'T.*.=.*....=.....=.*.*.=.....T', // 9
    'T...=......=.....=*...*=...*.T', // 10
    'T============================T', // 11
    'T............................T', // 12
    'T..*..........*..~~~......*..T', // 13
    'T...............~~~~~........T', // 14
    'TT..............*~~~~.....TTTT', // 15
    'TTT...TTT.....TTT.~~..TTTTTTTT', // 16
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 17
  ],

  // Where visitors start: [column, row], and which way they face.
  spawn: { at: [11, 8], facing: 'up' },

  // Signs you can read by walking up to them and pressing A (Enter / Z), or by tapping them.
  signs: [
    {
      at: [13, 9],
      text: ['Welcome to my little town!', 'Walk into a building to look inside.', 'More to see to the right: NeuralShift and ARC-AGI!'],
    },
  ],
};
