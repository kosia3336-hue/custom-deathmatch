/**
 * 배포 패키지 생성 스크립트
 *
 * 실행: node scripts/make-release.mjs
 * pnpm run build 후 실행하면 서버에 올릴 파일만 모아 release/ 폴더를 생성합니다.
 *
 * 업로드: release/ 내용을 서버 ~/genius/ 에 덮어쓰기
 * 이후 서버에서: pm2 restart all
 */

import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const RELEASE = join(ROOT, 'release');

function copy(src, dest) {
  const srcPath = join(ROOT, src);
  const destPath = join(RELEASE, dest);
  if (!existsSync(srcPath)) {
    console.warn(`  ⚠  없음 (건너뜀): ${src}`);
    return;
  }
  mkdirSync(join(destPath, '..'), { recursive: true });
  cpSync(srcPath, destPath, { recursive: true });
  console.log(`  ✓  ${src}`);
}

// 초기화
if (existsSync(RELEASE)) rmSync(RELEASE, { recursive: true, force: true });
mkdirSync(RELEASE, { recursive: true });

// 프론트엔드
console.log('\n[프론트엔드]');
for (const item of [
  '.next',
  'package.json',
  'next.config.ts',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]) copy(item, item);

// 서버
console.log('\n[서버]');
for (const item of [
  'server/dist',
  'server/package.json',
]) copy(item, item);

console.log(`
✅  release/ 폴더 생성 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📤  서버 ~/genius/ 에 release/ 내용을 덮어쓰기 업로드
 🔄  업로드 후 서버에서: pm2 restart all
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ※ node_modules 는 패키지 변경 시에만 업로드하면 됩니다.
`);
