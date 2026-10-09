'use client';

import { GameMemoDisclosure } from '@/components/game/GameMemoDisclosure';
import type { ComponentProps } from 'react';
import OpponentPowderTracker from './OpponentPowderTracker';

type Props = ComponentProps<typeof OpponentPowderTracker> & { dalmaji: boolean };

/** 모바일은 '메모 열기' 버튼 하나만 둔다(요약·패널 없이). 누르면 3줄 −/+ 메모 시트. */
export default function OpponentPowderMemo({ dalmaji, ...tracker }: Props) {
  return (
    <GameMemoDisclosure title="상대 빛가루 추리" skin={dalmaji ? 'dalmaji' : null}>
      <OpponentPowderTracker {...tracker} />
    </GameMemoDisclosure>
  );
}
