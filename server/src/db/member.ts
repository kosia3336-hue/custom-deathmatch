/**
 * 회원 조회 헬퍼 (서버 service_role 기반).
 *
 * socket 인증 시 Supabase access_token 으로 회원 정보 (id, nickname, displayed_title) 를 한 번에 가져온다.
 */

import { getSupabaseAdmin, getMemberIdFromToken } from './supabase.js';

export interface MemberInfo {
  id: string;
  nickname: string;
  status: 'active' | 'suspended' | 'banned' | 'withdrawn';
  displayedTitle: { id: string; name: string; color: string } | null;
}

/** access_token → 회원 정보 (모두 미설정/실패 시 null) */
export async function getMemberFromAccessToken(accessToken: string): Promise<MemberInfo | null> {
  const memberId = await getMemberIdFromToken(accessToken);
  if (!memberId) return null;

  const sb = getSupabaseAdmin();

  const { data: memberRow, error: memberErr } = await sb
    .from('members')
    .select('id, nickname, withdrawn_at, displayed_title_id')
    .eq('id', memberId)
    .maybeSingle();
  if (memberErr || !memberRow) return null;
  const member = memberRow as { id: string; nickname: string; withdrawn_at: string | null; displayed_title_id: string | null };

  if (member.withdrawn_at) return null;

  const { data: privRow } = await sb
    .from('members_private')
    .select('status')
    .eq('member_id', memberId)
    .maybeSingle();
  const status = (privRow as { status?: string } | null)?.status as MemberInfo['status'] | undefined;

  let displayedTitle: MemberInfo['displayedTitle'] = null;
  if (member.displayed_title_id) {
    const { data: titleRow } = await sb
      .from('titles')
      .select('id, name, color')
      .eq('id', member.displayed_title_id)
      .maybeSingle();
    const title = titleRow as { id: string; name: string; color: string } | null;
    if (title) {
      displayedTitle = { id: title.id, name: title.name, color: title.color };
    }
  }

  return {
    id: member.id,
    nickname: member.nickname,
    status: status ?? 'active',
    displayedTitle,
  };
}
