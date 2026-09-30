function makeSprite(rows, palette, scale = 3) {
  const h = rows.length,
    w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = palette[ch] || '#ff00ff';
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  return c;
}

const SPRITES = {};

// Охотник
SPRITES.hunter = makeSprite(
  [
    '....HHHH....',
    '...HHHHHH...',
    '..HSSSSSSH..',
    '..HSEESESH..',
    '..SSSSSSSS..',
    '...SSSSSS...',
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
    '.CCYYYYYYCC.',
    '..CCCCCCCC..',
    '..LL....LL..',
    '..LL....LL..',
  ],
  {
    H: '#16101f',
    S: '#d8b090',
    E: '#e0303a',
    C: '#2a1a4a',
    Y: '#c09028',
    L: '#0a0812',
  },
);

// Маг
SPRITES.mage = makeSprite(
  [
    '.....HH.....',
    '....HHHH....',
    '...HHHHHH...',
    '..HHHHHHHH..',
    '..SSSSSSSS..',
    '..SPEEEPSP..',
    '..SSSSSSSS..',
    '.PPPPPPPPPP.',
    'PPPPPPPPPPPP',
    '.PPPPPPPPPP.',
    '.PPPPPPPPPP.',
    '..LL....LL..',
  ],
  { H: '#3a1a6a', S: '#e8c8a8', E: '#a080e0', P: '#5a2a8a', L: '#0a0612' },
);

// Рыцарь
SPRITES.knight = makeSprite(
  [
    '...SSSSSS...',
    '..SSSSSSSS..',
    '..SEEEEESS..',
    '..SSSSSSSS..',
    '...SSSSSS...',
    '..AAAAAAAA..',
    '.AAYYYYYYAA.',
    '.AAAAAAAAAA.',
    '.AA.AAAA.AA.',
    '.AA.AAAA.AA.',
    '..A..AA..A..',
    '..LL....LL..',
  ],
  { S: '#9098a8', E: '#0a0612', A: '#5a6a8a', Y: '#d0a030', L: '#0a0812' },
);

// Паладин — золотой шлем, белый доспех, крест
SPRITES.paladin = makeSprite(
  [
    '...GGGGGG...',
    '..GGGGGGGG..',
    '..GSSSSSSG..',
    '..GSEEEESG..',
    '..GSSSSSSG..',
    '...SSSSSS...',
    '..WWWWWWWW..',
    '.WWWYYYYWWW.',
    '.WWW.WW.WWW.',
    '.WWWWWWWWWW.',
    '..WWWWWWWW..',
    '..LL....LL..',
  ],
  {
    G: '#c0a030',
    S: '#e8c8a8',
    E: '#3060c0',
    W: '#e8e8f0',
    Y: '#c0a030',
    L: '#3a3040',
  },
);

// Чернокнижник — тёмный капюшон, фиолетовые глаза, посох
SPRITES.warlock = makeSprite(
  [
    '....HHHH....',
    '...HHHHHH...',
    '..HHHHHHHH..',
    '..HSEEEESH..',
    '..HSSSSSSH..',
    '...SSSSSS...',
    '..RRRRRRRR..',
    '.RRRRRRRRRR.',
    '.RRRGGGGRRR.',
    '..RRRRRRRR..',
    '..LL....LL..',
    '..LL....LL..',
  ],
  {
    H: '#1a0a2a',
    S: '#c0a088',
    E: '#a040ff',
    R: '#4a1a6a',
    G: '#c0a030',
    L: '#0a0a12',
  },
);

// Враги
SPRITES.bat = makeSprite(
  [
    '.BB....BB.',
    'BBBB..BBBB',
    'BBBBBBBBBB',
    '.BBBBBBBB.',
    '..BBBBBB..',
    '..B.BB.B..',
    '...B..B...',
  ],
  { B: '#3a1a26' },
);

SPRITES.zombie = makeSprite(
  [
    '....GGGG....',
    '...GGGGGG...',
    '...GWWWWG...',
    '...GW..WG...',
    '...GGGGGG...',
    '...GTTTTG...',
    '...GGGGGG...',
    '..GGGGGGGG..',
    '..G.GGGG.G..',
    '..GG.GG.GG..',
    '...G....G...',
    '...G....G...',
  ],
  { G: '#4a6a2a', W: '#e0d040', T: '#a02828' },
);

SPRITES.ghost = makeSprite(
  [
    '....PPPP....',
    '...PPPPPP...',
    '..PPPPPPPP..',
    '..PPB..BPP..',
    '..PPPPPPPP..',
    '..PPPPPPPP..',
    '..PPPPPPPP..',
    '..PPPPPPPP..',
    '..PPPPPPPP..',
    '..P.P..P.P..',
    '..P.PP.PP.P.',
    '..P.P....P..',
  ],
  { P: '#a8b4e0', B: '#3a1a5a' },
);

SPRITES.wolf = makeSprite(
  [
    '..W......W..',
    '..WW....WW..',
    '..WWWWWWWW..',
    '.WWWWWWWWWW.',
    '.WWYYYYYYWW.',
    '.WWY.YY.YWW.',
    '.WWWWWWWWWW.',
    '..WWWWWWWW..',
    '..WGGGGGGW..',
    '..W.GGGG.W..',
    '..W......W..',
    '..WW....WW..',
  ],
  { W: '#4a3840', Y: '#e0c020', G: '#2a1818' },
);

SPRITES.boss = makeSprite(
  [
    '..D........D..',
    '..DD......DD..',
    '..DDDDDDDDDD..',
    '.DDDDDDDDDDDD.',
    '.DDYYYYYYYYDD.',
    '.DDY.YY.YY.DD.',
    '.DDDDDDDDDDDD.',
    '.DDDDDDDDDDDD.',
    '.DDGGGGGGGGDD.',
    '.DDGGGGGGGGDD.',
    '..DDGGGGGGDD..',
    '..DD.DDDD.DD..',
    '..D..DDDD..D..',
    '.....D..D.....',
  ],
  { D: '#5a1020', Y: '#ff3020', G: '#3a0812' },
  4,
);

SPRITES.boss2 = makeSprite(
  [
    '..D........D..',
    '..DD......DD..',
    '..DDDDDDDDDD..',
    '.DDDDDDDDDDDD.',
    '.DDYYYYYYYYDD.',
    '.DDY.YY.YY.DD.',
    '.DDDDDDDDDDDD.',
    '.DDDDDDDDDDDD.',
    '.DDGGGGGGGGDD.',
    '.DDGGGGGGGGDD.',
    '..DDGGGGGGDD..',
    '..DD.DDDD.DD..',
    '..D..DDDD..D..',
    '.....D..D.....',
  ],
  { D: '#3a1060', Y: '#c080ff', G: '#1a0830' },
  4,
);

SPRITES.crystal = makeSprite(['..C..', '.CCC.', 'CCWCC', '.CCC.', '..C..'], {
  C: '#22d3ee',
  W: '#ffffff',
});

SPRITES.heart = makeSprite(
  ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
  { R: '#e8304a' },
);

SPRITES.grave = makeSprite(
  [
    '..SSSS..',
    '.SSSSSS.',
    'SS.SS.SS',
    'SS.SS.SS',
    'SSSSSSSS',
    'SSSSSSSS',
    '.SSSSSS.',
    '.SSSSSS.',
  ],
  { S: '#4a4a58' },
  4,
);

SPRITES.tree = makeSprite(
  [
    '...TT....T..',
    '..TTTT..TTT.',
    '..TTTTTTTTT.',
    '.TTTTTTTTTTT',
    '..TTTTTTTT..',
    '...TTTTTT...',
    '.....TT.....',
    '.....TT.....',
    '.....TT.....',
    '.....TT.....',
    '.....TT.....',
    '....TTTT....',
  ],
  { T: '#1a1420' },
  4,
);

SPRITES.bush = makeSprite(
  ['..BB..BB..', '.BBBBBBBB.', 'BBBBBBBBBB', '.BBBBBBBB.', '..BB..BB..'],
  { B: '#1e2a1a' },
);

// Сундук с босса
SPRITES.chest = makeSprite(
  [
    '..GGGGGGGGGG..',
    '.GYYYYYYYYYYG.',
    'GYGGGGGGGGGGYG',
    'GYGTTTTTTTTGYG',
    'GYGTTTTTTTTGYG',
    'GYGGGGGGGGGGYG',
    'GYYYYYYYYYYYYG',
    'GYYYYYYYYYYYYG',
    'GYYYYYYYYYYYYG',
    'GYYYYYYYYYYYYG',
    'GGGGGGGGGGGGGG',
    '.GGGGGGGGGGGG.',
    '..GGGGGGGGGG..',
  ],
  {
    G: '#6a4020',
    Y: '#e0a040',
    T: '#c83040',
  },
  3,
);

function drawSprite(ctx, sprite, x, y, w = null, h = null, flipX = false) {
  const sw = w ?? sprite.width,
    sh = h ?? sprite.height;
  if (flipX) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, x - sw / 2, y - sh / 2, sw, sh);
  }
}
