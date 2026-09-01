import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourcePath = join(projectRoot, 'handover/design-assets/seed-seotda/source.png');
const outputDir = join(projectRoot, 'public/games/cards/seed-seotda');
const previewPath = join(projectRoot, 'handover/design-assets/seed-seotda/preview.webp');
const backPath = join(projectRoot, 'public/games/cards/parts-v2/card-back.webp');
const tempDir = mkdtempSync(join(tmpdir(), 'cdm-seed-seotda-'));

const spriteColumns = 6;
const spriteRows = 4;
const cellWidth = 190;
const cellHeight = 294;
const cardWidth = 174;
const cardHeight = 278;

// 원본은 한 행에 두 달(각 4장)씩 배치되어 있다. 시드섯다는 각 달의 앞 두 장만 쓴다.
const rowOrigins = [12, 154, 297, 439, 582];
const columnOrigins = [14, 106, 198, 290, 382, 474, 566, 658];
const selectedSourceCells = Array.from({ length: 10 }, (_, monthIndex) => {
  const row = Math.floor(monthIndex / 2);
  const monthColumn = monthIndex % 2 === 0 ? 0 : 4;
  return [
    { month: monthIndex + 1, variant: 'a', x: columnOrigins[monthColumn], y: rowOrigins[row] },
    { month: monthIndex + 1, variant: 'b', x: columnOrigins[monthColumn + 1], y: rowOrigins[row] },
  ];
}).flat();

function runMagick(args) {
  execFileSync('magick', args, { stdio: 'inherit' });
}

mkdirSync(outputDir, { recursive: true });

try {
  const cardPaths = selectedSourceCells.map((card) => {
    const outputPath = join(tempDir, `card-${card.month}${card.variant}.png`);
    runMagick([
      sourcePath,
      '-crop',
      `92x143+${card.x}+${card.y}`,
      '+repage',
      '-fuzz',
      '2%',
      '-trim',
      '+repage',
      '-resize',
      `${cardWidth}x${cardHeight}!`,
      outputPath,
    ]);
    return outputPath;
  });

  const spriteSources = [...cardPaths, backPath];
  const cellPaths = spriteSources.map((source, index) => {
    const cellPath = join(tempDir, `cell-${index}.png`);
    runMagick([
      source,
      '-resize',
      `${cardWidth}x${cardHeight}!`,
      '-gravity',
      'center',
      '-background',
      'none',
      '-extent',
      `${cellWidth}x${cellHeight}`,
      cellPath,
    ]);
    return cellPath;
  });
  while (cellPaths.length < spriteColumns * spriteRows) {
    const emptyPath = join(tempDir, `cell-empty-${cellPaths.length}.png`);
    runMagick(['-size', `${cellWidth}x${cellHeight}`, 'xc:none', emptyPath]);
    cellPaths.push(emptyPath);
  }

  const rowPaths = Array.from({ length: spriteRows }, (_, row) => {
    const rowPath = join(tempDir, `row-${row}.png`);
    runMagick([
      ...cellPaths.slice(row * spriteColumns, (row + 1) * spriteColumns),
      '+append',
      rowPath,
    ]);
    return rowPath;
  });
  runMagick([
    ...rowPaths,
    '-append',
    '-quality',
    '90',
    '-define',
    'webp:method=6',
    '-define',
    'webp:alpha-quality=100',
    join(outputDir, 'seed-seotda-cards.webp'),
  ]);

  runMagick([
    'montage',
    '-font',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    ...cardPaths,
    backPath,
    '-thumbnail',
    '87x139!',
    '-tile',
    '7x3',
    '-geometry',
    '87x139+8+10',
    '-background',
    '#f4efe8',
    '-quality',
    '88',
    '-define',
    'webp:method=6',
    previewPath,
  ]);

  const cards = Object.fromEntries(
    selectedSourceCells.map((card, index) => [
      `${card.month}${card.variant}`,
      {
        month: card.month,
        variant: card.variant,
        column: index % spriteColumns,
        row: Math.floor(index / spriteColumns),
      },
    ]),
  );
  writeFileSync(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify(
      {
        version: 1,
        format: 'webp',
        sprite: 'seed-seotda-cards.webp',
        spriteSize: {
          width: spriteColumns * cellWidth,
          height: spriteRows * cellHeight,
        },
        grid: { columns: spriteColumns, rows: spriteRows },
        cell: { width: cellWidth, height: cellHeight },
        card: {
          width: cardWidth,
          height: cardHeight,
          insetX: (cellWidth - cardWidth) / 2,
          insetY: (cellHeight - cardHeight) / 2,
        },
        cards,
        back: { column: 2, row: 3 },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
