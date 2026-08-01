/**
 * POST /api/me/nickname/change
 *  body: { newNick: string; useTicket?: boolean }
 *
 *  - SettingsTab(클라) 에서 호출.
 *  - 30일 쿨다운 안 지났을 때 useTicket=true 면 닉네임 변경권 1개를 차감해 우회.
 *  - RPC change_nickname_with_ticket 은 SECURITY DEFINER 로 auth.uid() 사용.
 *  - 응답에 usedTicket / ticketCountAfter 포함 → 클라이언트 인벤토리/모달 안내 갱신.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { notifyInventoryUpdated } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

async function notifyHiddenTitlesNicknameChanged(memberId: string): Promise<void> {
  const url =
    (process.env.SOCKET_SERVER_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_SOCKET_URL ??
      'http://localhost:4001') + '/internal/hidden-titles/check';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.INTERNAL_SECRET ?? 'dev-internal-secret',
        kind: 'nickname_changed',
        memberId,
      }),
    });
  } catch {
    // 소켓 서버 다운 — 무시
  }
}

interface Body {
  newNick?: string;
  useTicket?: boolean;
}

interface RpcRow {
  used_ticket: boolean;
  ticket_count_after: number;
}

const ERROR_HTTP: Record<string, { status: number; msg: string; code: string }> = {
  '22023': { status: 409, msg: '닉네임 변경 쿨다운(30일)이 남아있습니다.', code: 'cooldown' },
  '23505': { status: 409, msg: '사용할 수 없는 닉네임입니다.', code: 'invalid_nickname' },
  '42501': { status: 403, msg: '권한이 없습니다.', code: 'forbidden' },
  '42704': { status: 404, msg: '회원을 찾을 수 없습니다.', code: 'not_found' },
  P0001: { status: 409, msg: '닉네임 변경권이 없습니다.', code: 'no_ticket' },
};

export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json(
      { error: '로그인이 필요합니다.', code: 'unauthorized' },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: '잘못된 요청입니다.', code: 'invalid_request' },
      { status: 400 },
    );
  }

  const newNick = String(body.newNick ?? '').trim();
  if (!newNick || newNick.length > 16) {
    return NextResponse.json(
      { error: '닉네임은 1~16자로 입력해 주세요.', code: 'invalid_request' },
      { status: 400 },
    );
  }
  const useTicket = body.useTicket === true;

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('change_nickname_with_ticket', {
    p_new_nick: newNick,
    p_use_ticket: useTicket,
  });

  if (error) {
    const e = error as { code?: string; message?: string };
    const mapped = ERROR_HTTP[e.code ?? ''] ?? null;
    if (mapped) {
      return NextResponse.json({ error: mapped.msg, code: mapped.code }, { status: mapped.status });
    }
    console.warn(`[me/nickname/change] RPC 실패: ${e.message}`);
    return NextResponse.json(
      { error: '닉네임 변경에 실패했습니다.', code: 'internal_error' },
      { status: 500 },
    );
  }

  const row: RpcRow | undefined = Array.isArray(data) ? data[0] : data;
  const usedTicket = row?.used_ticket === true;
  const ticketCountAfter = Number(row?.ticket_count_after ?? 0);

  // 히든 칭호 훅 (변장의 명수) — 소켓 서버 internal endpoint 직접 호출.
  void notifyHiddenTitlesNicknameChanged(member.id);

  // 변경권 사용했다면 다른 탭/창의 인벤토리도 동기화.
  if (usedTicket) {
    void notifyInventoryUpdated({
      memberId: member.id,
      kind: 'nickname_change',
      countAfter: ticketCountAfter,
      reason: 'manual_use',
      ref: { kind: 'nickname_change', id: member.id },
    });
  }

  return NextResponse.json({
    ok: true,
    newNickname: newNick,
    usedTicket,
    ticketCountAfter,
  });
}
