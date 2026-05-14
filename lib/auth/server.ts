/**
 * 서버 측 인증/회원 헬퍼.
 *
 * Server Component, Route Handler, Server Action 어디서든 호출 가능.
 *
 * 회원 라이프사이클:
 *   - LOGGED_OUT     : auth.user 없음
 *   - SIGNUP_PENDING : auth.user 있으나 members 행이 없음 (가입 미완료)
 *   - ACTIVE         : 정상 회원
 *   - SUSPENDED      : 일시정지
 *   - BANNED         : 영구정지
 *   - WITHDRAWN      : 탈퇴 (소프트 삭제, /withdrawn 화면으로 리다이렉트, 복구 가능)
 */

import 'server-only';

import { getServerSupabase } from '@/lib/supabase/server';
import type { MemberStatus, TitleColor } from '@/lib/supabase/database.types';

export type AuthState =
  | { kind: 'LOGGED_OUT' }
  | { kind: 'SIGNUP_PENDING'; userId: string }
  | { kind: 'ACTIVE'; member: CurrentMember }
  | { kind: 'SUSPENDED'; member: CurrentMember; suspendedUntil: string | null; suspendedReason: string | null }
  | { kind: 'BANNED'; member: CurrentMember; bannedReason: string | null }
  | { kind: 'WITHDRAWN'; userId: string };

export interface CurrentMember {
  id: string;
  nickname: string;
  status: MemberStatus;
  role: 'user' | 'admin';
  createdAt: string;
  displayedTitle: { id: string; name: string; color: TitleColor } | null;
}

interface MemberRowSel {
  id: string;
  nickname: string;
  created_at: string;
  withdrawn_at: string | null;
  displayed_title_id: string | null;
}

interface PrivRowSel {
  role: 'user' | 'admin';
  status: MemberStatus;
  suspended_until: string | null;
  suspended_reason: string | null;
  banned_reason: string | null;
}

interface TitleRowSel {
  id: string;
  name: string;
  color: TitleColor;
}

export async function getAuthState(): Promise<AuthState> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { kind: 'LOGGED_OUT' };

  const memberRes = await supabase
    .from('members')
    .select('id, nickname, created_at, withdrawn_at, displayed_title_id')
    .eq('id', user.id)
    .maybeSingle();

  if (memberRes.error || !memberRes.data) {
    return { kind: 'SIGNUP_PENDING', userId: user.id };
  }
  const memberRow = memberRes.data as unknown as MemberRowSel;

  if (memberRow.withdrawn_at) {
    return { kind: 'WITHDRAWN', userId: user.id };
  }

  const privRes = await supabase
    .from('members_private')
    .select('role, status, suspended_until, suspended_reason, banned_reason')
    .eq('member_id', user.id)
    .maybeSingle();

  const privRow = (privRes.data as unknown as PrivRowSel) ?? null;

  let displayedTitle: { id: string; name: string; color: TitleColor } | null = null;
  if (memberRow.displayed_title_id) {
    const titleRes = await supabase
      .from('titles')
      .select('id, name, color')
      .eq('id', memberRow.displayed_title_id)
      .maybeSingle();
    const titleRow = (titleRes.data as unknown as TitleRowSel) ?? null;
    if (titleRow) {
      displayedTitle = { id: titleRow.id, name: titleRow.name, color: titleRow.color };
    }
  }

  const member: CurrentMember = {
    id: memberRow.id,
    nickname: memberRow.nickname,
    status: privRow?.status ?? 'active',
    role: privRow?.role ?? 'user',
    createdAt: memberRow.created_at,
    displayedTitle,
  };

  if (privRow?.status === 'banned') {
    return { kind: 'BANNED', member, bannedReason: privRow.banned_reason };
  }
  if (privRow?.status === 'suspended') {
    return {
      kind: 'SUSPENDED',
      member,
      suspendedUntil: privRow.suspended_until,
      suspendedReason: privRow.suspended_reason,
    };
  }
  return { kind: 'ACTIVE', member };
}

export async function getActiveMember(): Promise<CurrentMember | null> {
  const state = await getAuthState();
  return state.kind === 'ACTIVE' ? state.member : null;
}

/** API 라우트에서 ACTIVE 회원 가드. null 반환 시 401/403 처리는 호출자 책임. */
export async function requireActiveMember(): Promise<CurrentMember | null> {
  return getActiveMember();
}
