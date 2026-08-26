import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyGuildMembers } from '@/lib/guild-v4/notify';
import { ADMIN_GUILD_ACTIONS, mapAdminGuildError, type AdminGuildAction } from '@/lib/admin/guild-act';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** POST /api/admin/guilds/[id] */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없습니다.', 503);

  const { id: guildId } = await ctx.params;
  if (!UUID_RE.test(guildId)) return err('잘못된 길드입니다.');

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return err('잘못된 JSON');
  }

  const action = String(body.action ?? '') as AdminGuildAction;
  if (!ADMIN_GUILD_ACTIONS.includes(action)) return err('잘못된 작업입니다.');

  const payload: Record<string, unknown> = { ...body };
  delete payload.action;

  const sb = getSupabaseServiceRole();
  const { data, error } = await (sb.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>)('admin_guild_act', {
    p_actor_id: admin.id,
    p_action: action,
    p_guild_id: guildId,
    p_payload: payload,
  });

  if (error) {
    const mapped = mapAdminGuildError(error.message);
    return err(mapped.msg, mapped.status);
  }

  const result = (data ?? {}) as { notifyMemberIds?: string[] };
  const ids = Array.isArray(result.notifyMemberIds)
    ? result.notifyMemberIds.filter((x): x is string => typeof x === 'string')
    : [];
  if (ids.length > 0) void notifyGuildMembers(ids);

  return NextResponse.json({ ok: true, ...((data as object) ?? {}) });
}
