import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

type GuildAction = 'create' | 'join' | 'cancel_join' | 'decide' | 'expand' | 'leave' | 'buy_buff' | 'kick';

interface Body {
  action?: GuildAction;
  name?: string;
  description?: string;
  guildId?: string;
  requestId?: string;
  approve?: boolean;
  targetMemberId?: string;
}

/** RPC RAISE EXCEPTION 메시지 → 사용자 메시지 */
const ERROR_MSG: Record<string, { status: number; msg: string }> = {
  already_in_guild: { status: 409, msg: '이미 길드에 가입되어 있어요.' },
  no_charter: { status: 402, msg: '길드 창설권이 필요해요. 상점에서 구매할 수 있어요.' },
  name_taken: { status: 409, msg: '이미 사용 중인 길드 이름이에요.' },
  guild_not_found: { status: 404, msg: '길드를 찾을 수 없어요.' },
  guild_full: { status: 409, msg: '길드 정원이 가득 찼어요.' },
  already_requested: { status: 409, msg: '이미 가입 신청 중이에요.' },
  request_not_found: { status: 404, msg: '신청을 찾을 수 없어요.' },
  forbidden: { status: 403, msg: '길드장만 할 수 있어요.' },
  owner_must_disband_last: {
    status: 409,
    msg: '길드장은 다른 길드원이 모두 탈퇴한 뒤에 해체할 수 있어요.',
  },
  capacity_max: { status: 409, msg: '더 이상 정원을 늘릴 수 없어요.' },
  insufficient_guild_points: { status: 402, msg: '길드 포인트가 부족해요.' },
  buff_max_level: { status: 409, msg: '버프가 이미 최대 레벨이에요.' },
  cannot_kick_self: { status: 400, msg: '본인은 추방할 수 없어요. 탈퇴를 이용해 주세요.' },
  member_not_found: { status: 404, msg: '길드원을 찾을 수 없어요.' },
};

function mapError(message: string | undefined | null) {
  if (message) {
    console.warn('[guild:action] RPC 오류:', message);
    for (const key of Object.keys(ERROR_MSG)) {
      if (message.includes(key)) return ERROR_MSG[key]!;
    }
  }
  return { status: 500, msg: '처리 중 오류가 발생했어요.' };
}

/** POST /api/guild/action — 길드 생성/가입신청/취소/승인·거절/확장/탈퇴 */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없어요.' }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
  }

  const sb = getSupabaseServiceRole();
  // 주의: sb.rpc 를 변수로 떼어내면 this 바인딩이 끊겨 내부(this.rest) 접근에서 죽는다 — bind 필수
  const rpc = sb.rpc.bind(sb) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  try {
    switch (body.action) {
      case 'create': {
        const name = (body.name ?? '').trim();
        if (name.length < 2 || name.length > 20) {
          return NextResponse.json({ error: '길드 이름은 2~20자예요.' }, { status: 400 });
        }
        const description = (body.description ?? '').trim().slice(0, 200);
        const { data, error } = await rpc('create_guild', {
          p_member: member.id,
          p_name: name,
          p_description: description,
        });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true, data });
      }
      case 'join': {
        if (!body.guildId) return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
        const { error } = await rpc('request_guild_join', {
          p_member: member.id,
          p_guild: body.guildId,
        });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true });
      }
      case 'cancel_join': {
        if (!body.requestId) return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
        const { error } = await rpc('cancel_guild_join', {
          p_member: member.id,
          p_request: body.requestId,
        });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true });
      }
      case 'decide': {
        if (!body.requestId || typeof body.approve !== 'boolean') {
          return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
        }
        const { error } = await rpc('decide_guild_join', {
          p_owner: member.id,
          p_request: body.requestId,
          p_approve: body.approve,
        });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true });
      }
      case 'expand': {
        const { data, error } = await rpc('buy_guild_expansion', { p_owner: member.id });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true, data });
      }
      case 'buy_buff': {
        const { data, error } = await rpc('buy_guild_buff', { p_owner: member.id });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true, data });
      }
      case 'leave': {
        const { error } = await rpc('leave_guild', { p_member: member.id });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true });
      }
      case 'kick': {
        if (!body.targetMemberId) return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
        const { error } = await rpc('kick_guild_member', {
          p_owner: member.id,
          p_target: body.targetMemberId,
        });
        if (error) {
          const e = mapError(error.message);
          return NextResponse.json({ error: e.msg }, { status: e.status });
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
    }
  } catch (err) {
    console.error('[guild:action] 예외:', body?.action, (err as Error).message, (err as Error).stack?.split('\n')[1]);
    return NextResponse.json({ error: '처리 중 오류가 발생했어요.' }, { status: 500 });
  }
}
