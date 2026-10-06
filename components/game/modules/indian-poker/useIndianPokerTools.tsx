'use client';

import { useMemo } from 'react';
import type { IndianPokerGameData } from '@/shared/types/indian-poker';
import { useGameToolsRegistration, type GameTool } from '@/contexts/GameToolsContext';
import Scoreboard from './Scoreboard';
import RoundHistory from './RoundHistory';

export function useIndianPokerTools(data: IndianPokerGameData, myId: string) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const score = useMemo(
    () => <Scoreboard data={data} myId={myId} showTitle={!desktop} />,
    [data, myId, desktop],
  );
  const history = useMemo(
    () => (
      <RoundHistory
        roundHistory={data.roundHistory}
        players={data.players}
        compact={!desktop}
        showTitle={!desktop}
      />
    ),
    [data.roundHistory, data.players, desktop],
  );
  const info = useMemo(
    () => (
      <div className="flex min-w-0 flex-col gap-2">
        {score}
        {history}
      </div>
    ),
    [score, history],
  );
  const tools = useMemo<GameTool[]>(
    () => [
      {
        id: 'score',
        title: '플레이어 점수판',
        content: score,
        defaultOrder: 0,
        sizeToContent: true,
        mobileSlot: 'info',
      },
      {
        id: 'round-history',
        title: '라운드 기록',
        content: history,
        defaultOrder: 10,
        preferredBodyHeight: 240,
        mobileSlot: 'info',
      },
    ],
    [score, history],
  );
  return { info, tools };
}
