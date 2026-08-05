import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {},
  // 확인용 빌드가 운영 산출물을 덮어쓰지 않도록 분리할 수 있게 해 둔다:
  //   NEXT_DIST_DIR=.next-verify npx next build
  // (배포는 releases/<timestamp> 안에서 도므로 운영과 애초에 겹치지 않는다)
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // 게임서버(Fastify, 4001) HTTP API 프록시 — same-origin 으로 CORS 회피
  async rewrites() {
    return [{ source: '/api/games', destination: 'http://127.0.0.1:4001/api/games' }];
  },
};

export default nextConfig;
