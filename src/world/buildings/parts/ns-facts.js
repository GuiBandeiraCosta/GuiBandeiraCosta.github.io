// Facts about my work at NeuralShift, used by the NeuralShift building (neuralshift.js).
// Everything here comes from my CV (the 2026 version: AI Researcher / Engineer, April 2024 to April 2026).
// The projects section of the CV is left out on purpose.
// Also left out until I say otherwise: the product's name, the legal sector, clients and colleagues.
// Each string is one page of the text box: a whole sentence (or two) of at most 68 characters, so it reads well on
// its own. Never split a sentence across pages. A list is several pages.

export const COMPANY = {
  name: 'NeuralShift',
  city: 'Lisbon',
  role: 'AI Researcher / Engineer',
  from: 'April 2024',
  to: 'April 2026',
};

export const ENTRY = ['NeuralShift is an AI startup in Lisbon.', 'I worked there as an AI Researcher / Engineer from 2024 to 2026.'];

// The lines of my CV, each in plain words first.
export const CV = {
  accuracy: ['Our search product answers questions from the documents it finds.', 'My main work: I cut its wrong answers by 80%!'],
  how: [
    'How? First, an AI model checks each piece of text before it is used.',
    'Long documents are cut into pieces that keep their meaning.',
    'And hand-made ranking penalties push weak matches down in Vespa.',
  ],
  rag: ['Looking things up first, then answering, is called RAG.'],
  vespa: ['Vespa: a search engine spread over many machines.', 'It finds the passages that match a question, in a blink.'],
  spain: [
    'I played a key role when our product expanded to Spain.',
    'Pipelines running in Docker loaded over 200,000 Spanish documents.',
    'They went into our databases: MongoDB and Vespa.',
  ],
  benchmarks: [
    'A benchmark: the same test questions, asked of every new version.',
    'It shows whether a change really helps. I set up ours for search.',
  ],
  annotators: [
    "I found and managed annotators to write the benchmark's answers.",
    'When two annotators answer a question alike, we can trust it.',
    'That check is called inter-annotator agreement.',
  ],
  // Not on the 2026 CV, but kept on purpose (2026-10-07): the owner asked to keep the API vending machine.
  apis: ['I designed our REST APIs with versioned endpoints.', 'A new version never breaks the apps that still use an old one.'],
  paper: [
    'My research here: why Transformers struggle with ARC puzzles.',
    'The cause: positional encoding. I tested it with PyTorch.',
    'My first-author paper on it is on arXiv. ARC-AGI is next door!',
  ],
};


export const RUN_TIP = ['Tip: hold Shift (or B) to run. Fitting, for NeuralShift!'];
