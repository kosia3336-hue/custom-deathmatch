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

import { cache } from 'react';
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
  displayedTitle: { id: string; name: string; color: TitleColor; effect: string | null } | null;
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
  settings: Record<string, unknown> | null;
}

interface TitleRowSel {
  id: string;
  name: string;
  color: TitleColor;
  effect: string | null;
}

/**
 * 아래 조회들은 모두 React `cache` 로 감싼다.
 * 한 요청 안에서 레이아웃·페이지·중첩 컴포넌트가 각각 인증 상태를 물어보는데,
 * 감싸지 않으면 그때마다 Supabase 왕복이 새로 발생한다(특히 auth.getUser 는 매번
 * 네트워크 호출이다). 캐시는 요청 단위라 요청 간에 상태가 새지 않는다.
 */
const getCurrentUser = cache(async () => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

const getMemberRow = cache(async (userId: string): Promise<MemberRowSel | null> => {
  const supabase = await getServerSupabase();
  const res = await supabase
    .from('members')
    .select('id, nickname, created_at, withdrawn_at, displayed_title_id')
    .eq('id', userId)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as unknown as MemberRowSel;
});

const getPrivRow = cache(async (userId: string): Promise<PrivRowSel | null> => {
  const supabase = await getServerSupabase();
  const res = await supabase
    .from('members_private')
    .select('role, status, suspended_until, suspended_reason, banned_reason, settings')
    .eq('member_id', userId)
    .maybeSingle();
  return (res.data as unknown as PrivRowSel) ?? null;
});

/** 계정 설정(BGM 등). 인증 상태 조회와 members_private 왕복을 공유한다. */
export async function getAccountSettings(): Promise<{
  isLoggedIn: boolean;
  settings: Record<string, unknown>;
}> {
  const user = await getCurrentUser();
  if (!user) return { isLoggedIn: false, settings: {} };
  const priv = await getPrivRow(user.id);
  return { isLoggedIn: true, settings: priv?.settings ?? {} };
}

export const getAuthState = cache(async (): Promise<AuthState> => {
  const user = await getCurrentUser();

  if (!user) return { kind: 'LOGGED_OUT' };

  // members / members_private 는 서로 독립적이라 순차로 기다릴 이유가 없다.
  const [memberRow, privRow] = await Promise.all([
    getMemberRow(user.id),
    getPrivRow(user.id),
  ]);

  if (!memberRow) {
    return { kind: 'SIGNUP_PENDING', userId: user.id };
  }

  if (memberRow.withdrawn_at) {
    return { kind: 'WITHDRAWN', userId: user.id };
  }

  let displayedTitle: CurrentMember['displayedTitle'] = null;
  if (memberRow.displayed_title_id) {
    const supabase = await getServerSupabase();
    const titleRes = await supabase
      .from('titles')
      .select('id, name, color, effect')
      .eq('id', memberRow.displayed_title_id)
      .maybeSingle();
    const titleRow = (titleRes.data as unknown as TitleRowSel) ?? null;
    if (titleRow) {
      displayedTitle = { id: titleRow.id, name: titleRow.name, color: titleRow.color, effect: titleRow.effect ?? null };
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
});

export async function getActiveMember(): Promise<CurrentMember | null> {
  const state = await getAuthState();
  return state.kind === 'ACTIVE' ? state.member : null;
}

/** API 라우트에서 ACTIVE 회원 가드. null 반환 시 401/403 처리는 호출자 책임. */
export async function requireActiveMember(): Promise<CurrentMember | null> {
  return getActiveMember();
}
