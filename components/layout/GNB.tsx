'use client';

import { useEffect, useState } from 'react';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { GNB as CdmGNB } from '@/components/cdm/GNB';
import type { TitleColor } from '@/lib/supabase/database.types';

interface GNBProps {
  /** 룸/인게임 등에서 minimal=true 면 좁은 GNB */
  minimal?: boolean;
  /** 모바일에서 상단 헤더를 감춘다 (로비 — 화면 자체 헤더가 대신한다) */
  hideHeaderOnMobile?: boolean;
}

/**
 * v2 GNB 어댑터.
 * - 회원 정보가 로드되면 components/cdm/GNB 를 사용 (닉/칭호/드롭다운/로그아웃).
 * - 로딩 중이면 스켈레톤.
 * - 회원 없음 (예: Supabase 미설정 데모 모드) 이면 로고만 표시 + 로그인 버튼.
 */
export default function GNB({ minimal: _minimal, hideHeaderOnMobile }: GNBProps) {
  const { member, loading } = useCurrentMember();



  const cdmMember = member
    ? {
        id: member.id,
        nickname: member.nickname,
        status: 'active' as const,
        role: member.role,
        createdAt: '',
        displayedTitle: member.displayedTitle
          ? {
              id: member.displayedTitle.id,
              name: member.displayedTitle.name,
              color: member.displayedTitle.color as TitleColor,
              effect: member.displayedTitle.effect ?? null,
            }
          : null,
        displayedEffectId: null,
        canDevSwitch: member.canDevSwitch,
      }
    : null;

  // 로딩 중에도 nav(로비/랭킹/문의)는 보여야 함 — 우측만 스켈레톤 처리
  if (loading) {
    return (
      <CdmGNB member={null} loadingRight hideHeaderOnMobile={hideHeaderOnMobile} />
    );
  }

  return (
    <CdmGNB
      member={cdmMember}
      hideHeaderOnMobile={hideHeaderOnMobile}
    />
  );
}
