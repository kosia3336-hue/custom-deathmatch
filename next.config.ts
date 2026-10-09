import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {},
  // 확인용 빌드가 운영 산출물을 덮어쓰지 않도록 분리할 수 있게 해 둔다:
  //   NEXT_DIST_DIR=.next-verify npx next build
  // (배포는 releases/<timestamp> 안에서 도므로 운영과 애초에 겹치지 않는다)
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  /*
    public/ 의 이미지·소리는 Next 기본값(Cache-Control: max-age=0)이라 화면을 열 때마다
    파일마다 서버에 다시 묻는다. 파일 이름에 해시가 없으므로 길게 묶지는 않는다 —
    하루 동안은 그대로 쓰고, 이후 일주일은 먼저 보여 준 뒤 뒤에서 새로 받는다.
    (_next/static 은 Next 가 따로 immutable 로 붙인다)
  */
  async headers() {
    const cache = [
      { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
    ];
    return ['audio', 'brand', 'effects', 'games', 'guild', 'rank', 'rules', 'skins'].map((dir) => ({
      source: `/${dir}/:path*`,
      headers: cache,
    }));
  },
  // 게임서버(Fastify, 4001) HTTP API 프록시 — same-origin 으로 CORS 회피
  async rewrites() {
    return [{ source: '/api/games', destination: 'http://127.0.0.1:4001/api/games' }];
  },
};

export default nextConfig;
