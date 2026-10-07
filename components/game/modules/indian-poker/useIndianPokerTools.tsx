'use client';

import { useMemo } from 'react';
import type { IndianPokerGameData } from '@/shared/types/indian-poker';
import { type GameTool } from '@/contexts/GameToolsContext';
import Scoreboard from './Scoreboard';
import RoundHistory from './RoundHistory';

export function useIndianPokerTools(data: IndianPokerGameData, myId: string) {
  const score = useMemo(
    () => <Scoreboard data={data} myId={myId} showTitle={false} />,
    [data, myId],
  );
  const history = useMemo(
    () => (
      <RoundHistory
        roundHistory={data.roundHistory}
        players={data.players}
        compact={false}
        showTitle={false}
      />
    ),
    [data.roundHistory, data.players],
  );
  const tools = useMemo<GameTool[]>(
    () => [
      {
        id: 'score',
        title: '플레이어 점수판',
        kind: 'score',
        content: score,
        defaultOrder: 0,
        sizeToContent: true,
      },
      {
        id: 'round-history',
        title: '라운드 기록',
        kind: 'history',
        content: history,
        defaultOrder: 20,
        preferredBodyHeight: 240,
      },
    ],
    [score, history],
  );
  return { tools };
}
