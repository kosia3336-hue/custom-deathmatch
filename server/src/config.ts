const config = {
  port: Number(process.env.PORT ?? 4001),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001').split(','),
  roomAutoDestroyDelay: 120_000,
  /** Next.js API → 소켓 서버 내부 호출 인증용 공유 시크릿 */
  internalSecret: process.env.INTERNAL_SECRET ?? 'dev-internal-secret',
} as const;

export default config;
