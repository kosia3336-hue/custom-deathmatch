import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const sourceDir = join(projectRoot, 'public/games/cards/parts-v2');
const outputDir = join(projectRoot, 'public/games/cards/numeric-v2');
const previewDir = join(
  projectRoot,
  'handover/design-assets/card-composition-v2',
);
const tempDir = mkdtempSync(join(tmpdir(), 'cdm-card-compose-'));

const pipSize = 144;
const cornerPipSize = 86;
const spriteColumns = 6;
const spriteRows = 2;
const spriteCellWidth = 300;
const spriteCellHeight = 420;
const spriteCardWidth = 280;
const spriteCardHeight = 392;
const frontPath = join(sourceDir, 'card-front.webp');
const backPath = join(sourceDir, 'card-back.webp');
const pipPath = join(sourceDir, 'card-pip-crystal.webp');
const fontPath = '/System/Library/Fonts/Supplemental/Georgia.ttf';

const pipLayouts = {
  1: [[350, 490]],
  2: [[350, 365], [350, 615]],
  3: [[350, 305], [350, 490], [350, 675]],
  4: [[250, 365], [450, 365], [250, 615], [450, 615]],
  5: [[250, 365], [450, 365], [350, 490], [250, 615], [450, 615]],
  6: [[250, 310], [450, 310], [250, 490], [450, 490], [250, 670], [450, 670]],
  7: [[250, 280], [450, 280], [350, 410], [250, 540], [450, 540], [250, 690], [450, 690]],
  8: [[250, 270], [450, 270], [350, 380], [250, 490], [450, 490], [350, 600], [250, 710], [450, 710]],
  9: [[250, 270], [450, 270], [250, 400], [450, 400], [350, 490], [250, 580], [450, 580], [250, 710], [450, 710]],
  10: [[250, 250], [450, 250], [350, 340], [250, 430], [450, 430], [250, 550], [450, 550], [350, 640], [250, 730], [450, 730]],
};

function runMagick(args) {
  execFileSync('magick', args, { stdio: 'inherit' });
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

for (let value = 1; value <= 10; value += 1) {
  rmSync(join(outputDir, `card-${String(value).padStart(2, '0')}.webp`), {
    force: true,
  });
}
rmSync(join(outputDir, 'card-back.webp'), { force: true });

try {
  const cardPaths = [];
  const pipRenderedPath = join(tempDir, 'pip.png');
  const cornerPipPath = join(tempDir, 'corner-pip.png');
  const rotatedCornerPipPath = join(tempDir, 'corner-pip-rotated.png');
  runMagick([pipPath, '-resize', `${pipSize}x${pipSize}!`, pipRenderedPath]);
  runMagick([pipPath, '-resize', `${cornerPipSize}x${cornerPipSize}!`, cornerPipPath]);
  runMagick([cornerPipPath, '-rotate', '180', rotatedCornerPipPath]);

  for (let value = 1; value <= 10; value += 1) {
    const outputPath = join(tempDir, `card-${String(value).padStart(2, '0')}.png`);

    const composeArgs = [
      frontPath,
      cornerPipPath,
      '-gravity', 'northwest',
      '-geometry', '+38+28',
      '-compose', 'Over',
      '-composite',
      rotatedCornerPipPath,
      '-gravity', 'southeast',
      '-geometry', '+38+28',
      '-composite',
      '-gravity', 'northwest',
    ];

    for (const [centerX, centerY] of pipLayouts[value]) {
      composeArgs.push(
        pipRenderedPath,
        '-geometry', `+${centerX - pipSize / 2}+${centerY - pipSize / 2}`,
        '-composite',
      );
    }

    composeArgs.push(outputPath);
    runMagick(composeArgs);
    cardPaths.push(outputPath);
  }

  const spriteSources = [...cardPaths, backPath];
  const cellPaths = spriteSources.map((sourcePath, index) => {
    const cellPath = join(tempDir, `cell-${index}.png`);
    runMagick([
      sourcePath,
      '-resize', `${spriteCardWidth}x${spriteCardHeight}!`,
      '-gravity', 'center',
      '-background', 'none',
      '-extent', `${spriteCellWidth}x${spriteCellHeight}`,
      cellPath,
    ]);
    return cellPath;
  });
  const emptyCellPath = join(tempDir, 'cell-empty.png');
  runMagick([
    '-size', `${spriteCellWidth}x${spriteCellHeight}`,
    'xc:none',
    emptyCellPath,
  ]);
  cellPaths.push(emptyCellPath);

  const firstRowPath = join(tempDir, 'sprite-row-1.png');
  const secondRowPath = join(tempDir, 'sprite-row-2.png');
  runMagick([...cellPaths.slice(0, 6), '+append', firstRowPath]);
  runMagick([...cellPaths.slice(6, 12), '+append', secondRowPath]);
  runMagick([
    firstRowPath,
    secondRowPath,
    '-append',
    '-quality', '90',
    '-define', 'webp:method=6',
    '-define', 'webp:alpha-quality=100',
    join(outputDir, 'cdm-numeric-cards.webp'),
  ]);

  const previewPath = join(previewDir, 'cards-1-10-and-back.webp');
  runMagick([
    'montage',
    '-font', fontPath,
    ...cardPaths,
    backPath,
    '-thumbnail', '154x216',
    '-tile', '6x2',
    '-geometry', '154x216+16+18',
    '-background', '#ddd4c4',
    '-quality', '88',
    '-define', 'webp:method=6',
    previewPath,
  ]);

  writeFileSync(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify({
      version: 4,
      format: 'webp',
      sprite: 'cdm-numeric-cards.webp',
      spriteSize: {
        width: spriteColumns * spriteCellWidth,
        height: spriteRows * spriteCellHeight,
      },
      grid: { columns: spriteColumns, rows: spriteRows },
      cell: { width: spriteCellWidth, height: spriteCellHeight },
      card: {
        width: spriteCardWidth,
        height: spriteCardHeight,
        insetX: (spriteCellWidth - spriteCardWidth) / 2,
        insetY: (spriteCellHeight - spriteCardHeight) / 2,
      },
      cards: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => {
          const value = index + 1;
          return [value, {
            column: index % spriteColumns,
            row: Math.floor(index / spriteColumns),
          }];
        }),
      ),
      back: { column: 4, row: 1 },
      empty: { column: 5, row: 1 },
    }, null, 2)}\n`,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
