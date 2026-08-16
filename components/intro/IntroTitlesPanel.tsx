'use client';

import { TitleDetailModal } from '@/components/TitleDetailModal';
import type { TitleColor } from '@/lib/supabase/database.types';

export interface IntroTitleHolder {
  member_id: string;
  nickname: string;
  granted_at: string;
}

export interface IntroTitleModalData {
  id: string;
  name: string;
  color: TitleColor;
  effect: string | null;
  description: string | null;
  conditionText: string | null;
  isSystem: boolean;
  holderCount: number;
  holders: IntroTitleHolder[];
}

interface Props {
  modal: IntroTitleModalData;
}

/** 소개 칭호 — 실제 상세 모달 미리보기. */
export default function IntroTitlesPanel({ modal }: Props) {
  return (
    <TitleDetailModal
      open
      embedded
      titleId={modal.id}
      titleName={modal.name}
      titleColor={modal.color}
      titleEffect={modal.effect}
      description={modal.description}
      conditionText={modal.conditionText}
      isSystem={modal.isSystem}
      holderCount={modal.holderCount}
      initialHolders={modal.holders}
    />
  );
}
