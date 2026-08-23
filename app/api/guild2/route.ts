import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { GUILD_NAME_REGEX } from '@/lib/guild/types';
import { DEV_GUILD_DESC_MAX, DEV_GUILD_NAME_MAX, DEV_GUILD_NAME_MIN } from '@/components/guild-v4/limits';
import { mapGuildV4Error } from '@/lib/guild-v4/errors';
import { notifyGuildMembershipChanged, notifyGuildMembers } from '@/lib/guild-v4/notify';
import {
  findGuildIdForMember,
  listGuildMemberIds,
  loadGuildV4Snapshot,
  parseCatalogLogoId,
  rpcOf,
} from '@/lib/guild-v4/server';

export const dynamic = 'force-dynamic';

type Body = {
  action?: string;
  name?: string;
  description?: string;
  guildId?: string;
  requestId?: string;
  approve?: boolean;
  targetMemberId?: string;
  promote?: boolean;
  markUrl?: string;
  logoId?: string;
  cdp?: number;
  amount?: number;
  title?: string;
  body?: string;
  noticeId?: string;
  periodKind?: string;
  periodKey?: string;
  order?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) {
    return jsonError('서비스 설정이 없습니다.', 503);
  }
  const member = await getActiveMember();
  if (!member) return jsonError('로그인이 필요합니다.', 401);
  try {
    const snap = await loadGuildV4Snapshot(member.id, member.nickname);
    return NextResponse.json(snap);
  } catch (err) {
    console.error('[guild2:GET]', (err as Error).message);
    return jsonError('길드 정보를 불러오지 못했습니다.', 500);
  }
}

/** POST /api/guild2 — 더미 대시보드 액션을 운영 RPC에 연결 */
export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return jsonError('로그인이 필요합니다.', 401);
  if (!isSupabaseServiceRoleConfigured()) return jsonError('서비스 설정이 없습니다.', 503);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError('잘못된 요청입니다.', 400);
  }

  const sb = getSupabaseServiceRole();
  const rpc = rpcOf(sb);

  try {
    switch (body.action) {
      case 'create': {
        const name = (body.name ?? '').trim();
        if (
          name.length < DEV_GUILD_NAME_MIN ||
          name.length > DEV_GUILD_NAME_MAX ||
          !GUILD_NAME_REGEX.test(name)
        ) {
          return jsonError('길드 이름은 영어·한글만, 2~10자입니다.', 400);
        }
        const description = (body.description ?? '').trim().slice(0, DEV_GUILD_DESC_MAX);
        const { error } = await rpc('create_guild', {
          p_member: member.id,
          p_name: name,
          p_description: description,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        await notifyGuildMembershipChanged(member.id);
        return NextResponse.json({ ok: true });
      }
      case 'join': {
        if (!body.guildId) return jsonError('잘못된 요청입니다.', 400);
        const { error } = await rpc('request_guild_join', {
          p_member: member.id,
          p_guild: body.guildId,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'cancel_join': {
        if (!body.requestId) return jsonError('잘못된 요청입니다.', 400);
        const { error } = await rpc('cancel_guild_join', {
          p_member: member.id,
          p_request: body.requestId,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'decide': {
        if (!body.requestId || typeof body.approve !== 'boolean') {
          return jsonError('잘못된 요청입니다.', 400);
        }
        const { data: reqRow } = await sb
          .from('guild_join_requests')
          .select('member_id')
          .eq('id', body.requestId)
          .maybeSingle();
        const targetMemberId = (reqRow as { member_id: string } | null)?.member_id;
        const { error } = await rpc('decide_guild_join', {
          p_owner: member.id,
          p_request: body.requestId,
          p_approve: body.approve,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        if (body.approve && targetMemberId) await notifyGuildMembershipChanged(targetMemberId);
        return NextResponse.json({ ok: true });
      }
      case 'expand': {
        const { error } = await rpc('buy_guild_expansion_v4', { p_actor: member.id });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'buy_buff': {
        const { error } = await rpc('buy_guild_buff_v4', { p_actor: member.id });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'leave': {
        const { data: roleRow } = await sb
          .from('guild_members')
          .select('guild_id, role')
          .eq('member_id', member.id)
          .maybeSingle();
        const row = roleRow as { guild_id: string; role: string } | null;
        if (!row) return jsonError('길드가 없습니다.', 400);
        if (row.role === 'owner') {
          const ids = await listGuildMemberIds(row.guild_id);
          const { error } = await rpc('disband_guild_v4', { p_actor: member.id });
          if (error) {
            const e = mapGuildV4Error(error.message);
            return jsonError(e.msg, e.status);
          }
          await notifyGuildMembers(ids);
        } else {
          const { error } = await rpc('leave_guild', { p_member: member.id });
          if (error) {
            const e = mapGuildV4Error(error.message);
            return jsonError(e.msg, e.status);
          }
          await notifyGuildMembershipChanged(member.id);
        }
        return NextResponse.json({ ok: true });
      }
      case 'kick': {
        if (!body.targetMemberId) return jsonError('잘못된 요청입니다.', 400);
        const { error } = await rpc('kick_guild_member', {
          p_actor: member.id,
          p_target: body.targetMemberId,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        await notifyGuildMembershipChanged(body.targetMemberId);
        return NextResponse.json({ ok: true });
      }
      case 'update_description': {
        const { error } = await rpc('update_guild_description_v4', {
          p_actor: member.id,
          p_description: (body.description ?? '').slice(0, DEV_GUILD_DESC_MAX),
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'update_name': {
        const { error } = await rpc('update_guild_name_v4', {
          p_actor: member.id,
          p_name: (body.name ?? '').trim(),
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        const guildId = await findGuildIdForMember(member.id);
        if (guildId) await notifyGuildMembers(await listGuildMemberIds(guildId));
        return NextResponse.json({ ok: true });
      }
      case 'set_vice': {
        if (!body.targetMemberId || typeof body.promote !== 'boolean') {
          return jsonError('잘못된 요청입니다.', 400);
        }
        const { error } = await rpc('set_guild_vice_v4', {
          p_actor: member.id,
          p_target: body.targetMemberId,
          p_promote: body.promote,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'set_mark': {
        const logoId = (body.logoId ?? parseCatalogLogoId(String(body.markUrl ?? ''))) || '';
        if (!logoId) return jsonError('이미지를 선택해 주세요.', 400);
        const { error } = await rpc('set_guild_catalog_mark_v4', {
          p_actor: member.id,
          p_logo_id: logoId,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        const guildId = await findGuildIdForMember(member.id);
        if (guildId) await notifyGuildMembers(await listGuildMemberIds(guildId));
        return NextResponse.json({ ok: true });
      }
      case 'invest': {
        const cdp = Math.trunc(Number(body.cdp ?? 0));
        const { error } = await rpc('invest_guild_cdp_v4', {
          p_member: member.id,
          p_cdp: cdp,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'grant_cdp': {
        if (!body.targetMemberId) return jsonError('잘못된 요청입니다.', 400);
        const amount = Math.trunc(Number(body.amount ?? 0));
        const { error } = await rpc('grant_guild_cdp_v4', {
          p_actor: member.id,
          p_target: body.targetMemberId,
          p_amount: amount,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'transfer': {
        if (!body.targetMemberId) return jsonError('잘못된 요청입니다.', 400);
        const { error } = await rpc('transfer_guild_owner', {
          p_actor: member.id,
          p_target: body.targetMemberId,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        await notifyGuildMembers([member.id, body.targetMemberId]);
        return NextResponse.json({ ok: true });
      }
      case 'post_notice': {
        const { error } = await rpc('post_guild_notice_v4', {
          p_actor: member.id,
          p_title: body.title ?? '',
          p_body: body.body ?? '',
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'update_notice': {
        if (!body.noticeId) return jsonError('잘못된 요청입니다.', 400);
        const { error } = await rpc('update_guild_notice_v4', {
          p_actor: member.id,
          p_notice: body.noticeId,
          p_title: body.title ?? '',
          p_body: body.body ?? '',
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'delete_notice': {
        if (!body.noticeId) return jsonError('잘못된 요청입니다.', 400);
        const { error } = await rpc('delete_guild_notice_v4', {
          p_actor: member.id,
          p_notice: body.noticeId,
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'ack_rank_payout': {
        const { error } = await rpc('ack_guild_rank_payout_v4', {
          p_member: member.id,
          p_kind: body.periodKind ?? '',
          p_key: body.periodKey ?? '',
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'comment_notice': {
        if (!body.noticeId) return jsonError('잘못된 요청입니다.', 400);
        const { error } = await rpc('comment_guild_notice_v4', {
          p_actor: member.id,
          p_notice: body.noticeId,
          p_body: body.body ?? '',
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      case 'set_tile_order': {
        const { error } = await rpc('set_guild_tile_order_v4', {
          p_actor: member.id,
          p_order: body.order ?? [],
        });
        if (error) {
          const e = mapGuildV4Error(error.message);
          return jsonError(e.msg, e.status);
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return jsonError('잘못된 요청입니다.', 400);
    }
  } catch (err) {
    console.error('[guild2] 예외:', body?.action, (err as Error).message);
    return jsonError('처리 중 오류가 발생했습니다.', 500);
  }
}
