'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRoomStore } from '@/classic-era/stores/room';

export function useSaveRecord() {
  return useCallback(() => {
    const { gameResult: gr, room: rm } = useRoomStore.getState();
    if (!gr || !rm) return;

    const grd = gr.gameResultData as Record<string, unknown> | undefined;
    if (!grd?.actions) {
      toast.error('기록 데이터가 없습니다.');
      return;
    }

    const record = {
      version: '1.0',
      gameId: rm.gameId,
      gameName: rm.gameName,
      playedAt: new Date().toISOString(),
      playMode: rm.playMode,
      players: (grd.players as Record<string, { nickname: string }>) ?? {},
      result: {
        rankings: gr.rankings.map((r) => ({
          nickname: r.nickname,
          rank: r.rank,
          score: r.score,
        })),
        playTime: gr.playTime,
        totalTurns: gr.totalTurns,
      },
      gameRecord: {
        winType: (grd.winType as string) ?? null,
        winLine: grd.winLine ?? null,
        actions: grd.actions ?? [],
      },
    };

    const json = JSON.stringify(record, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const gameName = rm.gameName.replace(/\s+/g, '');

    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameName}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('기록이 저장되었습니다.');
  }, []);
}
