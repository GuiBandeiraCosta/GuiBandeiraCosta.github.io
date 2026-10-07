// Facts about ARC-AGI and my paper, used by the ARC-AGI building (arc.js) and the NeuralShift one.
// The dated scores are as of October 2026: re-check them before publishing, and again after the ARC Prize 2026
// results (4 December 2026). Sources: arcprize.org (its blog and leaderboard data), Lab42 (ARCathon) and arXiv.
// Wording rules: say "beaten", never "fully solved"; chart readings from the paper are "about 61", never "61%".
// Each string is one page of the text box: a whole sentence (or two) of at most 68 characters, so it reads well on
// its own. Never split a sentence across pages. A list is several pages.

export const AS_OF = 'October 2026';

export const PAPER = {
  title: 'The role of positional encodings in the ARC benchmark',
  authors: 'Guilherme H. Bandeira Costa, Miguel Freire and Arlindo L. Oliveira',
  url: 'https://arxiv.org/abs/2502.00174',
  date: 'January 2025',
  affiliations: 'INESC-ID and NeuralShift',
};

// The owner's own line: true for any start from 2023 to spring 2024 (records of 30-34%).
export const WHEN_I_STARTED = ['When I started, the best AI systems solved about 30% of ARC-AGI-1.'];

// Where ARC is now, in one breath.
export const NOW = [
  'Today, AI scores about 98% on ARC-AGI-1 and 95% on ARC-AGI-2.',
  'Both are effectively beaten. The newest, ARC-AGI-3, uses games.',
  `(Scores as of ${AS_OF}.)`,
];

// The timeline, one entry per milestone, each with its own pages (e.g. one mini cabinet or picture each).
export const TIMELINE = [
  { when: '2019', bar: 0, pages: ['2019: François Chollet, the creator of Keras, released ARC.', '400 practice puzzles, 400 public test puzzles, and hidden ones.'] },
  { when: '2020', bar: 20, pages: ['2020: the first ARC contest was won with about 20%.', 'GPT-3 scored 0%.'] },
  { when: '2023', bar: 30, pages: ['2023: the record crept up to about 30%.', 'In April 2024, it reached 34%.'] },
  { when: '2024', bar: 55, pages: ['June 2024: the ARC Prize launched, with over a million dollars.', 'Chatbots like GPT-4o solved only about 5%.', 'When the 2024 contest ended, the top score was 55.5%.'] },
  { when: 'Dec 2024', bar: 76, pages: ["December 2024: OpenAI's o3-preview scored 75.7%.", 'With about 172 times more computing power, it scored 87.5%.'] },
  { when: '2025', bar: 0, pages: ['January 2025: my paper on ARC came out on arXiv!', 'March 2025: ARC-AGI-2, with much harder puzzles. Chatbots: 0%.', 'Every one of its puzzles was solved by at least 2 people.'] },
  { when: '2026', bar: 98, pages: ['2026: the best AI scores 98.5% on ARC-AGI-1. A panel of people: 98%.', 'By September, it scored 95% on ARC-AGI-2 too. Both are beaten.'] },
  { when: 'ARC-AGI-3', bar: 63, pages: ['March 2026: ARC-AGI-3 uses games with no instructions at all.', 'People beat every game. The best AI at launch: under 1%.', "By September, one AI reached 62.7%, or 99.9% with its maker's setup.", `ARC-AGI-4 is already announced. (Scores as of ${AS_OF}.)`] },
];

// The paper, in plain words (each list is a few pages; pick what a room needs).
export const PAPER_PAGES = {
  intro: [`My paper: '${PAPER.title}'.`, `On arXiv, ${PAPER.date}, with Miguel Freire and Arlindo L. Oliveira.`],
  finding: [
    'For the paper, I built small transformers in PyTorch to test ideas.',
    'Each idea was a different way to tell a model where each square is.',
    'Giving each square its row and its column (2D) worked best.',
    'It beat the usual 1D way at every model size we tried.',
    'Even a one-layer 2D model competed with bigger 1D ones!',
    'With lots of data, a method called RoPE edged ahead.',
    'With little data, 2D won.',
  ],
  where: [`I wrote it at ${PAPER.affiliations}. NeuralShift is next door!`, 'A 2026 survey of ARC research, in the journal TMLR, cites it.'],
};


// The link card on the paper (shown after "Do you want to open the paper?").
export const PAPER_LINK = { url: PAPER.url, label: 'The paper on arXiv', ask: 'Do you want to open the paper?' };
