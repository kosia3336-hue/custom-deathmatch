#!/usr/bin/env node
/**
 * 원자적 배포 — 빌드가 성공했을 때만 pm2 재시작.
 *
 * 로컬에서 수동 배포할 때 사용:  node scripts/deploy.mjs
 *   (빌드만 하고 재시작을 깜빡해 .next 가 어긋나는 사고를 방지)
 *
 * CI(.github/workflows/deploy.yml)는 git 동기화를 별도로 하고 빌드/재시작만 이 흐름을 따른다.
 *
 * 단계: pnpm build (front+server) → 성공 시 pm2 restart genius-front genius-server → pm2 save
 * 빌드 실패 시 재시작하지 않고 종료(무중단, 옛 프로세스 유지).
 */
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: APP_DIR, stdio: 'inherit' });
}

try {
  console.log('▶ 빌드 (front + server)…');
  run('pnpm build');

  console.log('\n▶ 빌드 성공 — pm2 재시작');
  run('pm2 restart genius-front genius-server --update-env');
  run('pm2 save');

  console.log('\n✅ 배포 완료');
} catch (e) {
  console.error('\n❌ 빌드/재시작 실패 — 프로덕션 프로세스는 그대로 유지됩니다.');
  console.error(String(e.message ?? e));
  process.exit(1);
}
