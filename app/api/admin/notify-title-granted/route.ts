import { NextRequest, NextResponse } from 'next/server';
import { getAuthState } from '@/lib/auth/server';

export async function POST(req: NextRequest) {
  const auth = await getAuthState();
  if (auth.kind !== 'ACTIVE' || auth.member.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as {
    memberId: string;
    titleId: string;
    name: string;
    color: string;
    description: string | null;
  };

  const socketServerUrl =
    process.env.SOCKET_SERVER_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    'http://localhost:4001';

  const internalSecret = process.env.INTERNAL_SECRET ?? 'dev-internal-secret';

  try {
    await fetch(`${socketServerUrl}/internal/notify-title-granted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: internalSecret, ...body }),
    });
  } catch {
    // 소켓 서버 다운 등 — 조용히 실패 (Supabase notification으로 다음 접속 시 처리됨)
  }

  return NextResponse.json({ ok: true });
}
