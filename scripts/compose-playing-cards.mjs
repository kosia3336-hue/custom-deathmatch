import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourceDir = join(projectRoot, 'public/games/cards/parts-v2');
/*
  공용 숫자 카드 스프라이트 — 양면포커·인디언홀덤Q·초이스 홀덤이 함께 쓴다.
  0~9 앞면 1~10 · 10~19 숫자 뒷면 1~10 · 20 숫자 없는 뒷면(가려진 카드)
*/
const outputDir = join(projectRoot, 'public/games/cards/playing');
const previewDir = join(projectRoot, 'handover/design-assets/playing-cards');
const tempDir = mkdtempSync(join(tmpdir(), 'cdm-playing-cards-'));

const columns = 6;
const rows = 4;
const cellWidth = 300;
const cellHeight = 420;
const cardWidth = 280;
const cardHeight = 392;
const frontSource = join(sourceDir, 'card-front.webp');
const backSource = join(sourceDir, 'card-back.webp');
const pipSource = join(sourceDir, 'card-pip-crystal.webp');
const fontPath = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
const cornerPipSize = 86;
const cornerPip = join(tempDir, 'corner-pip.png');
const rotatedCornerPip = join(tempDir, 'corner-pip-rotated.png');

function magick(args) {
  execFileSync('magick', args, { stdio: 'inherit' });
}

function createFront(value, output) {
  magick([
    frontSource,
    '-fill',
    '#101936',
    '-font',
    fontPath,
    '-gravity',
    'center',
    '-pointsize',
    value === 10 ? '300' : '360',
    '-annotate',
    '+0+14',
    String(value),
    cornerPip,
    '-gravity',
    'northwest',
    '-geometry',
    '+38+28',
    '-compose',
    'Over',
    '-composite',
    rotatedCornerPip,
    '-gravity',
    'southeast',
    '-geometry',
    '+38+28',
    '-composite',
    output,
  ]);
}

function createReverse(value, output) {
  magick([
    backSource,
    '-fill',
    '#0d1433cc',
    '-stroke',
    '#f3dfaa',
    '-strokewidth',
    '8',
    '-draw',
    'roundrectangle 96,126 604,854 44,44',
    '-fill',
    '#fff7df',
    '-stroke',
    '#101936',
    '-strokewidth',
    '5',
    '-font',
    fontPath,
    '-gravity',
    'center',
    '-pointsize',
    value === 10 ? '290' : '350',
    '-annotate',
    '+0+14',
    String(value),
    cornerPip,
    '-gravity',
    'northwest',
    '-geometry',
    '+38+28',
    '-compose',
    'Over',
    '-composite',
    rotatedCornerPip,
    '-gravity',
    'southeast',
    '-geometry',
    '+38+28',
    '-composite',
    output,
  ]);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

try {
  magick([pipSource, '-resize', `${cornerPipSize}x${cornerPipSize}!`, cornerPip]);
  magick([cornerPip, '-rotate', '180', rotatedCornerPip]);
  const fronts = [];
  const reverses = [];
  for (let value = 1; value <= 10; value += 1) {
    const front = join(tempDir, `front-${value}.png`);
    const reverse = join(tempDir, `reverse-${value}.png`);
    createFront(value, front);
    createReverse(value, reverse);
    fronts.push(front);
    reverses.push(reverse);
  }

  // 숫자 없는 뒷면 — 숫자 뒷면과 같은 바탕에서 숫자 판만 뺀 것
  const plainBack = join(tempDir, 'plain-back.png');
  magick([backSource, plainBack]);

  const cells = [...fronts, ...reverses, plainBack].map((source, index) => {
    const cell = join(tempDir, `cell-${index}.png`);
    magick([
      source,
      '-resize',
      `${cardWidth}x${cardHeight}!`,
      '-gravity',
      'center',
      '-background',
      'none',
      '-extent',
      `${cellWidth}x${cellHeight}`,
      cell,
    ]);
    return cell;
  });
  const empty = join(tempDir, 'empty.png');
  magick(['-size', `${cellWidth}x${cellHeight}`, 'xc:none', empty]);
  while (cells.length < columns * rows) cells.push(empty);

  const rowPaths = Array.from({ length: rows }, (_, row) => {
    const rowPath = join(tempDir, `row-${row}.png`);
    magick([...cells.slice(row * columns, (row + 1) * columns), '+append', rowPath]);
    return rowPath;
  });
  magick([
    ...rowPaths,
    '-append',
    '-quality',
    '91',
    '-define',
    'webp:method=6',
    '-define',
    'webp:alpha-quality=100',
    join(outputDir, 'cdm-playing-cards.webp'),
  ]);

  magick([
    'montage',
    '-font',
    fontPath,
    ...fronts,
    ...reverses,
    plainBack,
    '-thumbnail',
    '140x196',
    '-tile',
    '5x5',
    '-geometry',
    '140x196+14+16',
    '-background',
    '#d7d1c7',
    '-quality',
    '90',
    '-define',
    'webp:method=6',
    join(previewDir, 'playing-card-set.webp'),
  ]);

  const locations = (startIndex) =>
    Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const spriteIndex = startIndex + index;
        return [
          index + 1,
          { column: spriteIndex % columns, row: Math.floor(spriteIndex / columns) },
        ];
      }),
    );
  writeFileSync(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify(
      {
        version: 3,
        format: 'webp',
        sprite: 'cdm-playing-cards.webp',
        grid: { columns, rows },
        cell: { width: cellWidth, height: cellHeight },
        card: { width: cardWidth, height: cardHeight },
        front: locations(0),
        reverse: locations(10),
        back: { column: 20 % columns, row: Math.floor(20 / columns) },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
