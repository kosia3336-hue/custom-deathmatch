/*
  이 모듈은 import 되는 순간 env 를 읽어 검증한다. 그래서 .env 로딩을 진입점
  (index.ts)의 `import 'dotenv/config'` 에만 맡기면 안 된다 — 번들러가 청크를
  쪼개면서 config 가 들어간 청크를 그보다 먼저 import 하면, ESM 은 import 를
  순서대로 평가하므로 .env 가 아직 안 읽힌 상태에서 여기가 실행된다.
  실제로 그렇게 깨져 INTERNAL_SECRET 미설정으로 기동 자체가 막혔다.
  번들 순서에 기대지 않도록 여기서도 직접 보장한다.
  dotenv 는 이미 있는 값을 덮어쓰지 않으므로 중복 로드는 안전하다.
*/
import 'dotenv/config';
import { timingSafeEqual } from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Next.js API → 소켓 서버 내부 엔드포인트 인증용 공유 시크릿.
 * 프로덕션에서 미설정 시 개발용 기본값으로 조용히 떨어지면 내부 엔드포인트(칭호 부여,
 * CDP 변동 알림 등)가 사실상 무인증이 되므로, 기동 자체를 막는다.
 */
function resolveInternalSecret(): string {
  const secret = process.env.INTERNAL_SECRET;
  if (secret) return secret;
  if (isProduction) {
    throw new Error(
      '[config] INTERNAL_SECRET 가 설정되지 않았습니다. server/.env 에 지정해 주세요.',
    );
  }
  return 'dev-internal-secret';
}

const config = {
  port: Number(process.env.PORT ?? 4001),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001').split(','),
  roomAutoDestroyDelay: 120_000,
  /** Next.js API → 소켓 서버 내부 호출 인증용 공유 시크릿 */
  internalSecret: resolveInternalSecret(),
} as const;

/** 내부 시크릿 검증. 길이 노출·타이밍 차이를 막기 위해 상수 시간 비교를 쓴다. */
export function isValidInternalSecret(secret: unknown): boolean {
  if (typeof secret !== 'string') return false;
  const expected = Buffer.from(config.internalSecret, 'utf8');
  const actual = Buffer.from(secret, 'utf8');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export default config;
