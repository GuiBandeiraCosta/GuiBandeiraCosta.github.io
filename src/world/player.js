// What your character looks like. Each letter is one pixel; change the colours in `palette`
// (e.g. H for hair, C for the shirt) to make it look like you. "." is transparent.
// Only down, up and left are drawn: right is left mirrored, and each "Step" frame is mirrored
// for the other leg. (So keep the hair one plain colour: a highlight on one side would flip sides every step.)

export default {
  palette: {
    K: '#2a2430', // outline
    H: '#7a4a2c', // hair
    S: '#f8c8a0', // skin
    s: '#dc9c74', // skin shadow
    E: '#2a2430', // eyes
    C: '#4caf50', // T-shirt (green)
    c: '#35843b', // T-shirt shadow
    P: '#404048', // trousers (black; a very dark grey so they don't melt into the outline)
    p: '#32323a', // trousers shadow
    B: '#7a4a28', // shoes (brown)
  },
  frames: {
    down: [
      '................',
      '.....KKKKKK.....',
      '....KHHHHHHK....',
      '...KHHHHHHHHK...',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '..KHHSHHHHSHHK..',
      '..KHSSSSSSSSHK..',
      '...KSEsSSsESK...',
      '...KsSSSSSSsK...',
      '....KKCCCCKK....',
      '...KSKCCCCKSK...',
      '...KsKcCCcKsK...',
      '....KPPPPPPK....',
      '....KPpKKpPK....',
      '....KBBK.KBBK...',
    ],
    downStep: [
      '................',
      '.....KKKKKK.....',
      '....KHHHHHHK....',
      '...KHHHHHHHHK...',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '..KHHSHHHHSHHK..',
      '..KHSSSSSSSSHK..',
      '...KSEsSSsESK...',
      '...KsSSSSSSsK...',
      '....KKCCCCKK....',
      '...KSKCCCCKK....',
      '...KsKcCCcKSK...',
      '....KPPPPPPKK...',
      '....KPpKKBBK....',
      '....KBBK.KK.....',
    ],
    up: [
      '................',
      '.....KKKKKK.....',
      '....KHHHHHHK....',
      '...KHHHHHHHHK...',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '...KHHHHHHHHK...',
      '...KsHHHHHHsK...',
      '....KKCCCCKK....',
      '...KSKCCCCKSK...',
      '...KsKcCCcKsK...',
      '....KPPPPPPK....',
      '....KPpKKpPK....',
      '....KBBK.KBBK...',
    ],
    upStep: [
      '................',
      '.....KKKKKK.....',
      '....KHHHHHHK....',
      '...KHHHHHHHHK...',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '..KHHHHHHHHHHK..',
      '...KHHHHHHHHK...',
      '...KsHHHHHHsK...',
      '....KKCCCCKK....',
      '....KKCCCCKSK...',
      '...KSKcCCcKsK...',
      '...KKPPPPPPK....',
      '....KBBKKpPK....',
      '.....KK.KBBK....',
    ],
    left: [
      '................',
      '.....KKKKK......',
      '....KHHHHHK.....',
      '...KHHHHHHHK....',
      '..KHHHHHHHHHK...',
      '..KHHHHHHHHHHK..',
      '.KSHHHHHHHHHHK..',
      '.KSSSHHHHHHHHK..',
      '.KSESSsHHHHHK...',
      '..KSSSSsHHHK....',
      '...KKKCCCKK.....',
      '...KCCCcCCK.....',
      '...KCCCScCK.....',
      '...KPPPPPPK.....',
      '....KPPpPK......',
      '....KBBBBK......',
    ],
    leftStep: [
      '................',
      '.....KKKKK......',
      '....KHHHHHK.....',
      '...KHHHHHHHK....',
      '..KHHHHHHHHHK...',
      '..KHHHHHHHHHHK..',
      '.KSHHHHHHHHHHK..',
      '.KSSSHHHHHHHHK..',
      '.KSESSsHHHHHK...',
      '..KSSSSsHHHK....',
      '...KKKCCCKK.....',
      '..KSCCCCcCK.....',
      '..KsKCCCCcK.....',
      '...KPPPPPPPK....',
      '..KPPKKKpPPK....',
      '..KBBK...KBBK...',
    ],
  },
};
