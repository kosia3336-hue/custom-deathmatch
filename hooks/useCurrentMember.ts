'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { useNicknameStore } from '@/stores/nickname';

export interface CurrentMemberClient {
  id: string;
  nickname: string;
  role: 'user' | 'admin';
  displayedTitle: { id: string; name: string; color: string; effect: string | null } | null;
}

interface State {
  member: CurrentMemberClient | null;
  loading: boolean;
}

/** 클라이언트에서 본인 회원 정보를 가져오는 훅. (GNB / 게임 화면 등) */
export function useCurrentMember(): State {
  // loading: false 로 시작 — 뒤로가기 시 스켈레톤이 무한정 남는 문제 방지
  // 세션이 확인되면 잠깐 true 로 전환 후 멤버 데이터를 받아 다시 false
  const [state, setState] = useState<State>({ member: null, loading: false });

  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured()) return;

    async function load() {
      try {
        const sb = getBrowserSupabase();
        // getSession() 은 localStorage 캐시를 읽어 네트워크 없이 즉시 반환
        const { data: sessionRes } = await sb.auth.getSession();
        if (!sessionRes.session?.user) return; // 비로그인 → 이미 false 상태

        // 세션 확인됨 → 멤버 데이터 로딩 시작
        if (!cancelled) setState({ member: null, loading: true });
        const userId = sessionRes.session.user.id;

        const { data: memberRow } = await sb
          .from('members')
          .select('id, nickname, displayed_title_id')
          .eq('id', userId)
          .maybeSingle();
        const member = memberRow as { id: string; nickname: string; displayed_title_id: string | null } | null;
        if (!member) {
          if (!cancelled) setState({ member: null, loading: false });
          return;
        }

        const { data: privRow } = await sb
          .from('members_private')
          .select('role')
          .eq('member_id', userId)
          .maybeSingle();
        const role = ((privRow as { role?: string } | null)?.role ?? 'user') as 'user' | 'admin';

        let displayedTitle: CurrentMemberClient['displayedTitle'] = null;
        if (member.displayed_title_id) {
          const { data: titleRow } = await sb
            .from('titles')
            .select('id, name, color, effect')
            .eq('id', member.displayed_title_id)
            .maybeSingle();
          const title = titleRow as { id: string; name: string; color: string; effect: string | null } | null;
          if (title) {
            displayedTitle = { ...title, effect: title.effect ?? null };
          }
        }

        if (!cancelled) {
          // 소켓 이벤트 타이밍에 상관없이 닉네임 스토어를 여기서 확실히 세팅
          useNicknameStore.getState().setNickname(member.nickname);
          setState({
            member: { id: member.id, nickname: member.nickname, role, displayedTitle },
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setState({ member: null, loading: false });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
