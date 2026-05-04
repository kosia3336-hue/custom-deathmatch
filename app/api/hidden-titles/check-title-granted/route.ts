import { NextRequest, NextResponse } from 'next/server';
import { getAuthState } from '@/lib/auth/server';

/**
 * 관리자 패널에서 칭호 수동 부여 직후 호출되는 히든 칭호 판정 트리거.
 *
 * - 관리자 전용.
 * - 실제 조건 로직은 소켓 서버에서 비공개로 수행.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthState();
  if (auth.kind !== 'ACTIVE' || auth.member.role !== 'admin') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { memberId?: string } | null;
  const memberId = body?.memberId;
  if (!memberId) {
    return NextResponse.json({ ok: false, error: 'memberId required' }, { status: 400 });
  }

  const socketServerUrl =
    process.env.SOCKET_SERVER_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    'http://localhost:4001';
  const internalSecret = process.env.INTERNAL_SECRET ?? 'dev-internal-secret';

  try {
    await fetch(`${socketServerUrl}/internal/hidden-titles/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: internalSecret, kind: 'title_granted', memberId }),
    });
  } catch {
    // 소켓 서버 다운 시 조용히 실패
  }

  return NextResponse.json({ ok: true });
}
