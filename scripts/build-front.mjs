/**
 * 프로덕션 프론트 빌드.
 *
 * 배포는 Git archive 로 받은 커밋에서 다시 빌드한다. .gitignore 된
 * app/dev · public/dev · app/super-ai 는 그 체크아웃에 없으므로 운영 번들에
 * 들어가지 않는다. 로컬 빌드는 에러 확인용이라 이 폴더를 옮기거나 지우지 않는다.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('pnpm', ['exec', 'next', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
