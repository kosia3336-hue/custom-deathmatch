import { NextResponse } from 'next/server';
import { getAuthState } from '@/lib/auth/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 공지 조회 기록 후 호출 — 유레카 히든 판정 (소켓 서버에서 비공개 처리).
 */
export async function POST(req: Request) {
  const auth = await getAuthState();
  if (auth.kind !== 'ACTIVE' && auth.kind !== 'SUSPENDED') {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const memberId =
    auth.kind === 'ACTIVE' || auth.kind === 'SUSPENDED' ? auth.member.id : null;
  if (!memberId) return NextResponse.json({ ok: false }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const noticeId =
    typeof body === 'object' && body !== null && 'noticeId' in body
      ? (body as { noticeId: unknown }).noticeId
      : null;
  if (typeof noticeId !== 'string' || !UUID_RE.test(noticeId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
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
      body: JSON.stringify({
        secret: internalSecret,
        kind: 'eureka_notice',
        memberId,
        noticeId,
      }),
    });
  } catch {
    // 소켓 서버 다운 시 무시
  }

  return NextResponse.json({ ok: true });
}
