import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
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

const width = 700;
const height = 980;
const pipSize = 112;
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

try {
  const cardPaths = [];
  const pipRenderedPath = join(tempDir, 'pip.webp');
  runMagick([pipPath, '-resize', `${pipSize}x${pipSize}!`, pipRenderedPath]);

  for (let value = 1; value <= 10; value += 1) {
    const numberPath = join(tempDir, `number-${value}.png`);
    const rotatedNumberPath = join(tempDir, `number-${value}-rotated.png`);
    const outputPath = join(outputDir, `card-${String(value).padStart(2, '0')}.webp`);
    runMagick([
      '-background', 'none',
      '-fill', '#111a3d',
      '-font', fontPath,
      '-pointsize', '62',
      `label:${value}`,
      numberPath,
    ]);
    runMagick([numberPath, '-rotate', '180', rotatedNumberPath]);

    const composeArgs = [
      frontPath,
      numberPath,
      '-gravity', 'northwest',
      '-geometry', '+55+43',
      '-compose', 'Over',
      '-composite',
      rotatedNumberPath,
      '-gravity', 'southeast',
      '-geometry', '+55+43',
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

    composeArgs.push(
      '-quality', '90',
      '-define', 'webp:method=6',
      '-define', 'webp:alpha-quality=100',
      outputPath,
    );
    runMagick(composeArgs);
    cardPaths.push(outputPath);
  }

  const finalBackPath = join(outputDir, 'card-back.webp');
  copyFileSync(backPath, finalBackPath);

  const previewPath = join(previewDir, 'cards-1-10-and-back.webp');
  runMagick([
    'montage',
    '-font', fontPath,
    ...cardPaths,
    finalBackPath,
    '-thumbnail', '154x216',
    '-tile', '6x2',
    '-geometry', '154x216+16+18',
    '-background', '#ddd4c4',
    '-shadow',
    '-quality', '88',
    '-define', 'webp:method=6',
    previewPath,
  ]);

  writeFileSync(
    join(outputDir, 'manifest.json'),
    `${JSON.stringify({
      version: 2,
      cardSize: { width, height },
      format: 'webp',
      cards: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => {
          const value = index + 1;
          return [value, `card-${String(value).padStart(2, '0')}.webp`];
        }),
      ),
      back: 'card-back.webp',
    }, null, 2)}\n`,
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
