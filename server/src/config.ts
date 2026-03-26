const config = {
  port: Number(process.env.PORT ?? 4001),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001').split(','),
  roomAutoDestroyDelay: 120_000,
} as const;

export default config;
