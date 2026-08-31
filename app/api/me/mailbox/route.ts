import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { mailboxRowToItem, type MailboxRow } from '@/lib/mailbox/map';

export const dynamic = 'force-dynamic';

function empty() {
  return NextResponse.json(
    { items: [], unreadCount: 0 },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

type RpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function rpc(name: string, args?: Record<string, unknown>) {
  const sb = (await getServerSupabase()) as unknown as RpcClient;
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

/** GET /api/me/mailbox — 원본 테이블과 맞춘 뒤 안 지운 편지. */
export async function GET() {
  const member = await getActiveMember();
  if (!member) return empty();

  try {
    const rows = ((await rpc('sync_and_list_mailbox')) ?? []) as MailboxRow[];
    const items = rows.map(mailboxRowToItem);
    return NextResponse.json(
      {
        items,
        unreadCount: items.reduce((n, m) => n + (m.readAt ? 0 : 1), 0),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.warn('[mailbox:list]', (e as Error).message);
    return err('우편함을 불러오지 못했습니다.', 500);
  }
}

type Body = { action?: string; id?: string };

/** POST /api/me/mailbox — read | read_all | delete */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return err('로그인이 필요합니다.', 401);

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return err('잘못된 JSON');
  }

  const action = String(body.action ?? '').trim();
  const id = String(body.id ?? '').trim();
  if (id.length > 200) return err('id가 너무 깁니다.');

  try {
    if (action === 'read') {
      if (!id) return err('id가 필요합니다.');
      await rpc('mark_mailbox_read', { p_source_key: id });
      return NextResponse.json({ ok: true });
    }
    if (action === 'read_all') {
      await rpc('mark_mailbox_all_read');
      return NextResponse.json({ ok: true });
    }
    if (action === 'delete') {
      if (!id) return err('id가 필요합니다.');
      /*
        미수령 보상이 달린 편지는 서버가 삭제를 거부한다. 지우면 보상을
        받을 길이 없어지기 때문이다. 거부 사유를 그대로 넘겨 클라가
        어떤 말을 띄울지 고르게 한다.
      */
      const rows = (await rpc('delete_mailbox_item', { p_source_key: id })) as
        | { deleted: boolean; reason: string }[]
        | null;
      const row = Array.isArray(rows) ? rows[0] : null;
      const deleted = Boolean(row?.deleted);
      if (!deleted) {
        const reason = String(row?.reason ?? '');
        return NextResponse.json(
          {
            ok: false,
            reason,
            error:
              reason === 'unclaimed_reward'
                ? '먼저 보상을 받아 주세요. 받지 않은 보상이 있는 편지는 지울 수 없습니다.'
                : '편지를 지우지 못했습니다.',
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (action === 'claim') {
      if (!id) return err('id가 필요합니다.');
      /*
        지급은 전적으로 RPC 안에서 끝난다. claimed_at 을 조건부로 찍고
        그 UPDATE 가 한 줄을 잡았을 때만 잔액을 올리므로, 두 번 눌러도
        두 번 지급되지 않는다. 여기서는 결과만 그대로 넘긴다.
      */
      const rows = (await rpc('claim_mailbox_reward', { p_source_key: id })) as
        | { claimed: boolean; amount: number; new_balance: number }[]
        | null;
      const row = Array.isArray(rows) ? rows[0] : null;
      return NextResponse.json({
        ok: true,
        claimed: Boolean(row?.claimed),
        amount: Number(row?.amount ?? 0),
        newBalance: Number(row?.new_balance ?? 0),
      });
    }
    return err('알 수 없는 action');
  } catch (e) {
    console.warn('[mailbox:mutate]', (e as Error).message);
    return err('우편함 저장에 실패했습니다.', 500);
  }
}
