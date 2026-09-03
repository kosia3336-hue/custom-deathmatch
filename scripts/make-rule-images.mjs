/*
  룰 이미지 생성기.

  관리자 페이지의 '룰 이미지'에 올릴 그림을 만든다. 손으로 그린 게 아니라
  게임이 실제로 쓰는 에셋·규칙에서 뽑아내므로, 규칙이 바뀌면 여기를 고쳐
  다시 돌리면 된다.

  필요한 것: ImageMagick 7 (magick), macOS 시스템 폰트.
  실행: node scripts/make-rule-images.mjs
  결과: handover/design-assets/rule-images/*.png

  ── 왜 SVG 텍스트를 안 쓰나 ──────────────────────────────────
  ImageMagick 의 내장 SVG 렌더러는 도형은 잘 그리지만 글꼴 해석이 불안하다.
  그래서 도형은 SVG 로, 글자는 -annotate 로 나눠 그린다.
*/
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const outDir = join(root, 'handover/design-assets/rule-images');
const tmp = mkdtempSync(join(tmpdir(), 'cdm-rule-img-'));

const KR_FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc';
const SYMBOL_FONT = '/System/Library/Fonts/Apple Symbols.ttf';

const INK = '#15161a';
const MUTED = '#6b6a63';
const PAPER = '#faf9f5';
const LINE = '#d9d6c9';

function magick(args) {
  execFileSync('magick', args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

/* ══════════════════════════════════════════════════════════
 * 1. 나이트의 여행 — 나이트 행마법
 *    5×5 가운데에 나이트, 갈 수 있는 8칸에 검은 별.
 * ══════════════════════════════════════════════════════════ */
function knightMoveImage() {
  const M = 56;
  const CELL = 168;
  const N = 5;
  const SIZE = M * 2 + CELL * N;
  const [KR, KC] = [2, 2];
  const MOVES = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];

  const star = (cx, cy, R) =>
    Array.from({ length: 10 }, (_, k) => {
      const ang = ((-90 + k * 36) * Math.PI) / 180;
      const rad = k % 2 === 0 ? R : R * 0.4;
      return `${(cx + rad * Math.cos(ang)).toFixed(1)},${(cy + rad * Math.sin(ang)).toFixed(1)}`;
    }).join(' ');

  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">`];
  svg.push(`<rect width="${SIZE}" height="${SIZE}" fill="${PAPER}"/>`);
  svg.push(
    `<rect x="${M - 10}" y="${M - 10}" width="${CELL * N + 20}" height="${CELL * N + 20}" rx="16" fill="#e9e7de" stroke="#c4c1b2" stroke-width="3"/>`,
  );
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const fill = (r + c) % 2 === 0 ? '#f6f5f0' : '#e6e4d9';
      svg.push(
        `<rect x="${M + c * CELL}" y="${M + r * CELL}" width="${CELL}" height="${CELL}" fill="${fill}" stroke="#cdcabb" stroke-width="2"/>`,
      );
    }
  }
  for (const [dr, dc] of MOVES) {
    const cx = M + (KC + dc) * CELL + CELL / 2;
    const cy = M + (KR + dr) * CELL + CELL / 2;
    svg.push(`<polygon points="${star(cx, cy, 50)}" fill="${INK}"/>`);
  }
  svg.push(
    `<rect x="${M + KC * CELL + 4}" y="${M + KR * CELL + 4}" width="${CELL - 8}" height="${CELL - 8}" rx="10" fill="#dcd9ff" stroke="#5b52d8" stroke-width="5"/>`,
  );
  svg.push('</svg>');

  const boardSvg = join(tmp, 'knight.svg');
  const boardPng = join(tmp, 'knight-board.png');
  const glyph = join(tmp, 'knight-glyph.png');
  writeFileSync(boardSvg, svg.join('\n'));
  magick(['-background', 'none', boardSvg, boardPng]);
  // 게임 화면과 같은 ♞ 글리프를 쓴다. 도형으로 다시 그리면 인상이 달라진다.
  magick([
    '-font', SYMBOL_FONT, '-pointsize', '150', '-background', 'none',
    '-fill', INK, 'label:♞', '-trim', '+repage', '-resize', 'x128', glyph,
  ]);
  magick([boardPng, glyph, '-gravity', 'center', '-composite',
    '-depth', '8', '-define', 'png:compression-level=9',
    join(outDir, 'knights-tour-move.png')]);
  return 'knights-tour-move.png';
}

/* ══════════════════════════════════════════════════════════
 * 2. 시드섯다 — 족보표
 *    카드 그림은 게임이 쓰는 스프라이트를 그대로 잘라 쓴다.
 * ══════════════════════════════════════════════════════════ */
const SPRITE = join(root, 'public/games/cards/seed-seotda/seed-seotda-cards.webp');
const CARD_W = 190;
const CARD_H = 294;
const SPRITE_COLS = 6;

/** 스프라이트 칸 번호. SeedSeotdaCard.tsx 의 spriteIndex 와 같은 식이다. */
const card = (month, variant = 'a') => (month - 1) * 2 + (variant === 'b' ? 1 : 0);

const BASIC = [
  ['삼팔광땡', [card(3), card(8)], '3광 + 8광'],
  ['광땡', [card(1), card(3)], '1광 + 3광, 또는 1광 + 8광'],
  ['땡', [card(10), card(10, 'b')], '같은 월 2장 · 장땡(10)이 가장 높고 삥땡(1)이 가장 낮다'],
  ['알리', [card(1), card(2)], '1월 + 2월'],
  ['독사', [card(1), card(4)], '1월 + 4월'],
  ['구삥', [card(1), card(9)], '1월 + 9월'],
  ['장삥', [card(1), card(10)], '1월 + 10월'],
  ['장사', [card(4), card(10)], '4월 + 10월'],
  ['세륙', [card(4), card(6)], '4월 + 6월'],
  ['갑오', [card(4), card(5)], '두 월의 합 끝수가 9'],
  ['끗', [card(3, 'b'), card(5)], '합 끝수 8~1 · 숫자가 클수록 높다 (그림은 8끗)'],
  ['망통', [card(2), card(8, 'b')], '두 월의 합 끝수가 0'],
];

const SPECIAL = [
  ['암행어사', [card(4), card(7)], '4월 열자리 + 7월 열자리 · 광땡을 이긴다(삼팔광땡 제외)'],
  ['땡잡이', [card(3), card(7)], '3월 + 7월이면 그림과 상관없이 모두 · 삥땡~9땡을 이긴다'],
  ['구사', [card(4, 'b'), card(9, 'b')], '상대가 땡 이상이면 패배 · 그 밖이면 재경기'],
  ['멍텅구리 구사', [card(4), card(9)], '4월·9월 열자리 · 상대가 광땡이면 패배, 그 밖이면 재경기'],
];

function seotdaRankImage() {
  const W = 840;
  const PAD = 28;
  const CW = 104; // 표에 쓸 카드 너비
  const CH = Math.round((CW * CARD_H) / CARD_W);
  const ROW_H = CH + 22;
  const HEAD_H = 62;
  const TITLE_H = 78;
  const FOOT_H = 96;
  const H =
    TITLE_H + HEAD_H + BASIC.length * ROW_H + HEAD_H + SPECIAL.length * ROW_H + FOOT_H;

  // 카드는 미리 잘라 둔다. 같은 칸을 여러 줄에서 쓰므로 한 번만 자른다.
  const used = new Set([...BASIC, ...SPECIAL].flatMap(([, pair]) => pair));
  const cropped = new Map();
  for (const idx of used) {
    const file = join(tmp, `c${idx}.png`);
    const x = (idx % SPRITE_COLS) * CARD_W;
    const y = Math.floor(idx / SPRITE_COLS) * CARD_H;
    /*
      월을 왼쪽 위에 배지로 얹는다. 게임 화면의 카드와 같은 표시라, 표를 보고
      판에서 카드를 찾을 때 그림이 아니라 숫자로 바로 맞출 수 있다.
    */
    const month = Math.floor(idx / 2) + 1;
    const card = join(tmp, `raw${idx}.png`);
    magick([SPRITE, '-crop', `${CARD_W}x${CARD_H}+${x}+${y}`, '+repage',
      '-resize', `${CW}x${CH}!`, card]);
    /*
      배지는 따로 만들어 얹는다. 원과 숫자를 한 번에 그리면 -draw 와 -annotate 의
      기준점이 달라 숫자가 원 밖으로 밀린다. 가운데 정렬은 gravity Center 가 정확하다.
    */
    const d = Math.round(CW * 0.3);
    const badge = join(tmp, `badge${month}.png`);
    magick([
      '-size', `${d}x${d}`, 'xc:none',
      '-fill', 'rgba(17,19,24,0.82)', '-draw', `circle ${d / 2},${d / 2} ${d / 2},0`,
      '-font', KR_FONT, '-pointsize', String(Math.round(d * 0.62)),
      '-fill', 'white', '-gravity', 'Center', '-annotate', '+0+0', String(month),
      badge,
    ]);
    const pad = Math.round(CW * 0.05);
    magick([card, badge, '-geometry', `+${pad}+${pad}`, '-composite', file]);
    cropped.set(idx, file);
  }

  const args = ['-size', `${W}x${H}`, `xc:${PAPER}`];
  const draw = [];
  const text = [];
  let y = 0;

  const section = (label) => {
    draw.push(`fill #efece0 stroke none rectangle ${PAD},${y + 12} ${W - PAD},${y + HEAD_H - 8}`);
    text.push(['26', INK, `+${PAD + 16}+${y + 44}`, label]);
    y += HEAD_H;
  };
  /*
    -annotate 는 줄바꿈을 해 주지 않는다. 글자 폭을 미리 재서 직접 끊는다.
    한글은 대략 글꼴 크기만큼의 폭을 차지하므로 그 값으로 어림한다.
  */
  const wrap = (value, pointSize, maxWidth) => {
    const perChar = pointSize * 0.98;
    const limit = Math.max(8, Math.floor(maxWidth / perChar));
    const lines = [];
    let line = '';
    for (const word of value.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= limit || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const row = ([name, pair, note], index, total) => {
    if (index < total - 1) {
      draw.push(`stroke ${LINE} stroke-width 1 line ${PAD},${y + ROW_H} ${W - PAD},${y + ROW_H}`);
    }
    const cy = y + Math.round((ROW_H - CH) / 2);
    pair.forEach((idx, k) => {
      const cx = PAD + 8 + k * (CW + 12);
      draw.push(`image over ${cx},${cy} ${CW},${CH} '${cropped.get(idx)}'`);
    });
    const tx = PAD + 8 + 2 * (CW + 12) + 18;
    const noteLines = wrap(note, 21, W - tx - PAD);
    const mid = y + Math.round(ROW_H / 2);
    const top = noteLines.length > 1 ? mid - 18 : mid - 6;
    text.push(['30', INK, `+${tx}+${top}`, name]);
    noteLines.forEach((line, i) => {
      text.push(['21', MUTED, `+${tx}+${top + 32 + i * 28}`, line]);
    });
    y += ROW_H;
  };

  text.push(['38', INK, `+${PAD + 8}+${52}`, '시드섯다 족보']);
  y = TITLE_H;
  section('기본 족보 — 위가 높다');
  BASIC.forEach((r, i) => row(r, i, BASIC.length));
  section('특수 족보 — 상대 패에 따라 판정이 달라진다');
  SPECIAL.forEach((r, i) => row(r, i, SPECIAL.length));
  wrap(
    '그림 종류(광·열자리·띠)는 위 조합을 가릴 때만 쓰이며, 같은 족보 안에서 그림에 따른 우열은 없다.',
    20,
    W - PAD * 2 - 16,
  ).forEach((line, i) => {
    text.push(['20', MUTED, `+${PAD + 8}+${H - 46 + i * 26}`, line]);
  });

  for (const d of draw) args.push('-draw', d);
  args.push('-font', KR_FONT);
  for (const [size, fill, pos, value] of text) {
    args.push('-pointsize', size, '-fill', fill, '-annotate', pos, value);
  }
  const png = join(outDir, 'seed-seotda-ranks.png');
  args.push('-depth', '8', '-define', 'png:compression-level=9', png);
  magick(args);
  // 카드 그림이 많아 PNG 는 무겁다. 올릴 때 쓸 webp 도 함께 만든다.
  magick([png, '-quality', '88', join(outDir, 'seed-seotda-ranks.webp')]);
  return 'seed-seotda-ranks.png + .webp';
}

mkdirSync(outDir, { recursive: true });
try {
  const made = [knightMoveImage(), seotdaRankImage()];
  console.log(`만든 이미지 ${made.length}개 → handover/design-assets/rule-images/`);
  for (const name of made) console.log(`  ${name}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
