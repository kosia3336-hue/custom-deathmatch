import { adsenseClient } from '@/lib/ads';

/**
 * /ads.txt — 애드센스가 광고 판매자를 확인하는 파일. 애드센스를 켰을 때만 내준다.
 * (미들웨어는 .txt 를 건너뛰므로 로그인 없이 열린다)
 */
export function GET() {
  const client = adsenseClient();
  if (!client) return new Response('Not found', { status: 404 });
  const pub = client.replace(/^ca-/, '');
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
