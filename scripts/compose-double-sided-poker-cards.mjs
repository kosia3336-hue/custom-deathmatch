import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourceDir = join(projectRoot, 'public/games/cards/parts-v2');
const outputDir = join(projectRoot, 'public/games/cards/double-sided-poker');
const previewDir = join(projectRoot, 'handover/design-assets/double-sided-poker');
const tempDir = mkdtempSync(join(tmpdir(), 'cdm-double-sided-poker-'));

const columns = 6;
const rows = 4;
const cellWidth = 300;
const cellHeight = 420;
const cardWidth = 280;
const cardHeight = 392;
const frontSource = join(sourceDir, 'card-front.webp');
const backSource = join(sourceDir, 'card-back.webp');
const logoSource = join(projectRoot, 'public/brand/logo3.webp');
const fontPath = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';

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
    '-gravity',
    'northwest',
    '-pointsize',
    '96',
    '-annotate',
    '+42+28',
    String(value),
    '-gravity',
    'southeast',
    '-annotate',
    '+42+28',
    String(value),
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
    '-fill',
    '#f3dfaa',
    '-stroke',
    '#101936',
    '-strokewidth',
    '3',
    '-gravity',
    'northwest',
    '-pointsize',
    '88',
    '-annotate',
    '+42+28',
    String(value),
    '-gravity',
    'southeast',
    '-annotate',
    '+42+28',
    String(value),
    output,
  ]);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

try {
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

  const logo = join(tempDir, 'logo.png');
  const hidden = join(tempDir, 'hidden.png');
  magick([logoSource, '-resize', '500x380', logo]);
  magick([
    backSource,
    logo,
    '-gravity',
    'center',
    '-geometry',
    '+0+0',
    '-compose',
    'Over',
    '-composite',
    hidden,
  ]);

  const cells = [...fronts, ...reverses, hidden].map((source, index) => {
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
    join(outputDir, 'double-sided-poker-cards.webp'),
  ]);

  magick([
    'montage',
    '-font',
    fontPath,
    ...fronts,
    ...reverses,
    hidden,
    '-thumbnail',
    '140x196',
    '-tile',
    '7x3',
    '-geometry',
    '140x196+14+16',
    '-background',
    '#d7d1c7',
    '-quality',
    '90',
    '-define',
    'webp:method=6',
    join(previewDir, 'double-sided-poker-card-set.webp'),
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
        version: 1,
        format: 'webp',
        sprite: 'double-sided-poker-cards.webp',
        grid: { columns, rows },
        cell: { width: cellWidth, height: cellHeight },
        card: { width: cardWidth, height: cardHeight },
        front: locations(0),
        reverse: locations(10),
        hidden: { column: 2, row: 3 },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
