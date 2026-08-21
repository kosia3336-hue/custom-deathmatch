import { createHmac } from 'node:crypto';
import { getSupabaseAdmin } from '../../db/supabase.js';
import { LIVE_DUMMY_EMAIL, LIVE_DUMMY_NICKNAME } from './window.js';

function titanPassword(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('[liveDummy] SUPABASE_SERVICE_ROLE_KEY 없음');
  return createHmac('sha256', key).update('dummy:titan').digest('hex');
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

/** 닉네임 타이탄 회원. 없으면 auth 유저 + members + members_private. */
export async function ensureTitanMember(): Promise<string> {
  const sb = getSupabaseAdmin();

  const { data: byNick, error: nickErr } = await sb
    .from('members')
    .select('id')
    .eq('nickname', LIVE_DUMMY_NICKNAME)
    .maybeSingle();
  if (nickErr) throw nickErr;
  if (byNick?.id) return byNick.id as string;

  let userId = await findAuthUserIdByEmail(sb, LIVE_DUMMY_EMAIL);
  if (!userId) {
    const created = await sb.auth.admin.createUser({
      email: LIVE_DUMMY_EMAIL,
      password: titanPassword(),
      email_confirm: true,
      user_metadata: { dummy: true, nickname: LIVE_DUMMY_NICKNAME },
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error('[liveDummy] createUser 실패');
    }
    userId = created.data.user.id;
  }

  const { error: memErr } = await sb.from('members').insert({
    id: userId,
    nickname: LIVE_DUMMY_NICKNAME,
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
