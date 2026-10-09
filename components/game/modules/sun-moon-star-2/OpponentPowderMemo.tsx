'use client';

import { GameMemoDisclosure } from '@/components/game/GameMemoDisclosure';
import type { ComponentProps } from 'react';
import OpponentPowderTracker from './OpponentPowderTracker';

type Props = ComponentProps<typeof OpponentPowderTracker> & { dalmaji: boolean };

export default function OpponentPowderMemo({ dalmaji, ...tracker }: Props) {
  const total = Object.values(tracker.estimate.perMark).reduce((sum, value) => sum + value, 0);
  return (
    <GameMemoDisclosure
      title="상대 빛가루 추리"
      skin={dalmaji ? 'dalmaji' : null}
      summary={
        <>
          R{tracker.round} · 합 {total}g
        </>
      }
    >
      <OpponentPowderTracker {...tracker} />
    </GameMemoDisclosure>
  );
}
