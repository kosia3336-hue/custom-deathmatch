import { NextResponse } from 'next/server';
import { getAuthState } from '@/lib/auth/server';

/**
 * 닉네임 변경 RPC 성공 직후 호출 — 둔갑술 등 히든 판정 (소켓 서버에서 비공개 처리).
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
      body: JSON.stringify({
        secret: internalSecret,
        kind: 'nickname_changed',
        memberId,
      }),
    });
  } catch {
    // 소켓 서버 다운 시 무시
  }

  return NextResponse.json({ ok: true });
}
