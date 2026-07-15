import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {},
  // 게임서버(Fastify, 4001) HTTP API 프록시 — same-origin 으로 CORS 회피
  async rewrites() {
    return [{ source: '/api/games', destination: 'http://127.0.0.1:4001/api/games' }];
  },
};

export default nextConfig;
