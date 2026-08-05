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
