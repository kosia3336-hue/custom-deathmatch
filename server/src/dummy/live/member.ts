import { createHmac } from 'node:crypto';
import { getSupabaseAdmin } from '../../db/supabase.js';
import type { LiveDummyRuntime } from './roster.js';
import { LIVE_DUMMY_ROSTER, findRosterByKey } from './roster.js';

function dummyPassword(seed: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('[liveDummy] SUPABASE_SERVICE_ROLE_KEY 없음');
  return createHmac('sha256', key).update(seed).digest('hex');
}

async function findAuthUserIdByEmail(
  sb: ReturnType<typeof getSupabaseAdmin>,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/** 닉이 있으면 그 id. 없으면 auth + members + members_private. */
export async function ensureLiveDummyMember(dummy: LiveDummyRuntime): Promise<string> {
  const sb = getSupabaseAdmin();

  const { data: byNick, error: nickErr } = await sb
    .from('members')
    .select('id')
    .eq('nickname', dummy.nickname)
    .maybeSingle();
  if (nickErr) throw nickErr;
  if (byNick?.id) return byNick.id as string;

  let userId = await findAuthUserIdByEmail(sb, dummy.email);
  if (!userId) {
    const created = await sb.auth.admin.createUser({
      email: dummy.email,
      password: dummyPassword(dummy.passwordSeed),
      email_confirm: true,
      user_metadata: { dummy: true, nickname: dummy.nickname },
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error(`[liveDummy] createUser 실패 ${dummy.nickname}`);
    }
    userId = created.data.user.id;
  }

  const { error: memErr } = await sb.from('members').insert({
    id: userId,
    nickname: dummy.nickname,
  });
  if (memErr && !String(memErr.message).toLowerCase().includes('duplicate')) {
    throw memErr;
  }

  const { error: privErr } = await sb.from('members_private').insert({
    member_id: userId,
    role: 'user',
    status: 'active',
  });
  if (privErr && !String(privErr.message).toLowerCase().includes('duplicate')) {
    throw privErr;
  }

  return userId;
}

export async function ensureTitanMember(): Promise<string> {
  return ensureLiveDummyMember(findRosterByKey('titan'));
}

export async function ensureAllLiveDummyMembers(): Promise<
  Array<{ dummy: LiveDummyRuntime; memberId: string }>
> {
  const out: Array<{ dummy: LiveDummyRuntime; memberId: string }> = [];
  for (const dummy of LIVE_DUMMY_ROSTER) {
    const memberId = await ensureLiveDummyMember(dummy);
    out.push({ dummy, memberId });
  }
  return out;
}
