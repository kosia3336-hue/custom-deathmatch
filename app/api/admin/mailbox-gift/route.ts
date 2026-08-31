import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/** 한 번에 보낼 수 있는 인원. 실수로 전체 발송하는 사고를 막는 상한이다. */
const MAX_RECIPIENTS = 500;
const MAX_CDP = 100000;

type Target =
  | { kind: 'members'; memberIds: string[] }
  | { kind: 'tier'; seasonId: number; tiers: string[] };

interface Body {
  title?: string;
  body?: string;
  sender?: string;
  cdp?: number;
  /** 같은 키로 두 번 보내면 두 번째는 무시된다. 중복 발송 사고를 막는다. */
  giftKey?: string;
  target?: Target;
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** POST /api/admin/mailbox-gift — 우편으로 보상(CDP) 발송 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return bad('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return bad('서비스 설정이 없습니다.', 503);

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return bad('잘못된 요청입니다.');
  }

  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  const sender = String(payload.sender ?? '운영팀').trim() || '운영팀';
  const cdp = Math.floor(Number(payload.cdp ?? 0));
  const giftKey = String(payload.giftKey ?? '').trim();

  if (!title || title.length > 100) return bad('제목은 1~100자로 적어 주세요.');
  if (body.length > 2000) return bad('본문은 2,000자 이하로 적어 주세요.');
  if (!Number.isFinite(cdp) || cdp < 0 || cdp > MAX_CDP) {
    return bad(`CDP 는 0 이상 ${MAX_CDP.toLocaleString()} 이하로 적어 주세요.`);
  }
  if (!giftKey || !/^[a-z0-9-]{3,60}$/.test(giftKey)) {
    return bad('우편 키는 영소문자·숫자·하이픈 3~60자로 적어 주세요.');
  }

  const target = payload.target;
  if (!target) return bad('받는 사람을 정해 주세요.');

  const sb = getSupabaseServiceRole();

  let memberIds: string[] = [];
  if (target.kind === 'members') {
    memberIds = [...new Set((target.memberIds ?? []).map(String).filter(Boolean))];
  } else if (target.kind === 'tier') {
    const seasonId = Number(target.seasonId);
    const tiers = (target.tiers ?? []).map(String).filter(Boolean);
    if (!Number.isInteger(seasonId) || tiers.length === 0) return bad('시즌과 티어를 정해 주세요.');
    // database.types.ts 가 아직 이 테이블을 모른다 (정본은 handover/infra/tables.md).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('rank_stats') as any)
      .select('member_id')
      .eq('season_id', seasonId)
      .in('tier', tiers);
    if (error) return bad('대상을 불러오지 못했습니다.', 500);
    memberIds = [
      ...new Set(
        ((data ?? []) as { member_id: string }[]).map((r) => String(r.member_id)).filter(Boolean),
      ),
    ];
  } else {
    return bad('알 수 없는 대상입니다.');
  }

  if (memberIds.length === 0) return bad('받는 사람이 없습니다.');
  if (memberIds.length > MAX_RECIPIENTS) {
    return bad(`한 번에 ${MAX_RECIPIENTS}명까지 보낼 수 있습니다. (현재 ${memberIds.length}명)`);
  }

  /*
    source_key 에 선물 키와 회원을 함께 넣는다. (member_id, source_key) 가 유니크라
    같은 키로 다시 보내도 ON CONFLICT DO NOTHING 으로 한 통만 남는다.
    payload.reward 는 수령 RPC 가 읽는 자리다.
  */
  const rows = memberIds.map((memberId) => ({
    member_id: memberId,
    source_key: `gift:${giftKey}`,
    kind: cdp > 0 ? 'reward' : 'system',
    title,
    body,
    sender,
    payload: cdp > 0 ? { reward: { cdp } } : {},
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error, count } = await (sb.from('mailbox_items') as any).upsert(rows, {
    onConflict: 'member_id,source_key',
    ignoreDuplicates: true,
    count: 'exact',
  });
  if (error) {
    console.warn('[admin:mailbox-gift]', error.message);
    return bad('발송에 실패했습니다.', 500);
  }

  return NextResponse.json({
    ok: true,
    targeted: memberIds.length,
    sent: count ?? 0,
    skipped: memberIds.length - (count ?? 0),
  });
}
