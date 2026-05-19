import { NextResponse } from 'next/server';
import { getAuthState } from '@/lib/auth/server';

/**
 * 상점 구매 완료 직후 호출되는 히든 칭호 판정 트리거.
 *
 * - 본인 인증 필요 (본인 memberId 로만 판정).
 * - 실제 조건 로직은 소켓 서버(hidden-titles/) 에서 비공개로 수행.
 * - fire-and-forget — 응답은 즉시 ok.
 */
export async function POST() {
  const auth = await getAuthState();
  if (auth.kind !== 'ACTIVE' && auth.kind !== 'SUSPENDED') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const memberId =
    auth.kind === 'ACTIVE' || auth.kind === 'SUSPENDED' ? auth.member.id : null;
  if (!memberId) return NextResponse.json({ ok: false }, { status: 403 });

  const socketServerUrl =
    process.env.SOCKET_SERVER_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    'http://localhost:4001';
  const internalSecret = process.env.INTERNAL_SECRET ?? 'dev-internal-secret';

  try {
    await fetch(`${socketServerUrl}/internal/hidden-titles/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: internalSecret, kind: 'shop_purchase', memberId }),
    });
  } catch {
    // 소켓 서버 다운 시 조용히 실패
  }

  return NextResponse.json({ ok: true });
}
