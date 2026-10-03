/**
 * 프로덕션 프론트 빌드.
 *
 * 로컬 전용 `app/dev` · `public/dev` · `app/super-ai` 는 gitignore 이고 운영 번들에도 넣지 않는다.
 * Next 는 app/ 아래를 전부 묶으므로, 빌드 동안 폴더를 저장소 밖 임시 디렉터리로
 * 빼 두었다가 끝나면 되돌린다. 저장소 안에 두면 tsc 가 그 파일을 다시 검사한다.
 * 클린 체크아웃에는 이 폴더가 없어서 그냥 next build 만 한다.
 *
 * Windows 는 폴더 rename 이 EPERM 나는 경우가 있어, 그때는 복사 뒤 삭제로 옮긴다.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const stashRoot = mkdtempSync(join(tmpdir(), 'cdm-dev-'));
const HIDES = [
  { src: join(ROOT, 'app/dev'), stash: join(stashRoot, 'app-dev') },
  { src: join(ROOT, 'public/dev'), stash: join(stashRoot, 'public-dev') },
  { src: join(ROOT, 'app/super-ai'), stash: join(stashRoot, 'app-super-ai') },
];

const hidden = [];

function removeDir(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 150 });
}

function moveDir(from, to) {
  if (existsSync(to)) removeDir(to);
  try {
    renameSync(from, to);
    return;
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw err;
  }
  cpSync(from, to, { recursive: true, force: true });
  removeDir(from);
}

function hide({ src, stash }) {
  if (!existsSync(src)) return;
  moveDir(src, stash);
  hidden.push({ src, stash });
}

function restore() {
  for (const { src, stash } of hidden.splice(0)) {
    if (!existsSync(stash)) continue;
    if (existsSync(src)) removeDir(src);
    moveDir(stash, src);
  }
  try {
    removeDir(stashRoot);
  } catch {
    // 임시 폴더 정리는 실패해도 소스 복구가 우선이다.
  }
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    restore();
    process.exit(1);
  });
}

for (const item of HIDES) hide(item);

let status = 1;
try {
  const result = spawnSync('pnpm', ['exec', 'next', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });
  if (result.error) {
    console.error(result.error);
    status = 1;
  } else {
    status = result.status ?? 1;
  }
} finally {
  restore();
}

process.exit(status);
