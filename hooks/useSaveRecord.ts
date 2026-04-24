'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRoomStore } from '@/stores/room';
import { GAME_IDS } from '@/shared/types';

function buildGameRecord(gameId: string, grd: Record<string, unknown>): unknown {
  if (gameId === GAME_IDS.DOUBLE_SIDED_CHESS) {
    return {
      winType: (grd.winType as string) ?? null,
      finalBoard: grd.finalBoard ?? null,
      prisoners: grd.prisoners ?? { first: [], second: [] },
      actions: grd.actions ?? [],
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.NUMBER_FOUR) {
    return {
      winType: (grd.winType as string) ?? null,
      tiebreakerReason: grd.tiebreakerReason ?? null,
      finalScores: grd.finalScores ?? {},
      roundHistory: grd.roundHistory ?? [],
      actions: grd.actions ?? [],
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.INDIAN_POKER) {
    return {
      winType: (grd.winType as string) ?? null,
      finalChips: grd.finalChips ?? {},
      totalRounds: grd.totalRounds ?? 0,
      deckCycles: grd.deckCycles ?? 1,
      finalAnte: grd.finalAnte ?? 1,
      initialChips: grd.initialChips ?? 25,
      roundHistory: grd.roundHistory ?? [],
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.INVEST_DONATE) {
    return {
      winType: (grd.winType as string) ?? null,
      finalScores: grd.finalScores ?? {},
      finalCoinStocks: grd.finalCoinStocks ?? {},
      totalRounds: grd.totalRounds ?? 0,
      actions: grd.actions ?? [],
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.BETTING_RPS) {
    return {
      winType: (grd.winType as string) ?? null,
      finalChips: grd.finalChips ?? {},
      totalRounds: grd.totalRounds ?? 0,
      actions: grd.actions ?? [],
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.MULTIPLE_BNW) {
    return {
      winType: (grd.winType as string) ?? null,
      finalScores: grd.finalScores ?? {},
      actions: grd.actions ?? [],
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.WINNING_STREAK) {
    return {
      winType: (grd.winType as string) ?? null,
      finalStats: grd.finalStats ?? {},
      actions: grd.actions ?? [],
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.SILPER_BNW) {
    return {
      winType: (grd.winType as string) ?? null,
      winnerId: grd.winnerId ?? null,
      finalScores: grd.finalScores ?? {},
      finalTiles: grd.finalTiles ?? {},
      totalRounds: grd.totalRounds ?? 0,
      rematchCount: grd.rematchCount ?? 0,
      segmentsHistory: grd.segmentsHistory ?? [],
      actions: grd.actions ?? [],
      players: grd.players ?? {},
      finishReason: grd.finishReason ?? null,
    };
  }
  if (gameId === GAME_IDS.GRAPE_SUGAR_2) {
    return {
      winType: (grd.winType as string) ?? null,
      finalScores: grd.finalScores ?? {},
      sides: grd.sides ?? { p1: '', p2: '' },
      totalRounds: grd.totalRounds ?? 0,
      extensions: grd.extensions ?? 0,
      stages: grd.stages ?? [],
      cardUsage: grd.cardUsage ?? { p1: [], p2: [] },
      players: grd.players ?? {},
    };
  }
  if (gameId === GAME_IDS.FIVE_TOWERS) {
    return {
      winType: (grd.winType as string) ?? null,
      winnerId: grd.winnerId ?? null,
      finalScores: grd.finalScores ?? {},
      totalTurns: grd.totalTurns ?? 0,
      finishReason: grd.finishReason ?? null,
      finalTowers: grd.finalTowers ?? {},
      itemsUsed: grd.itemsUsed ?? {},
      actions: grd.actions ?? [],
      milestones: grd.milestones ?? [],
      players: grd.players ?? {},
    };
  }
  // FOUR_GRAVITY 및 기타 게임
  return {
    winType: (grd.winType as string) ?? null,
    winLine: grd.winLine ?? null,
    actions: grd.actions ?? [],
  };
}

export function useSaveRecord() {
  return useCallback(() => {
    const { gameResult: gr, room: rm } = useRoomStore.getState();
    if (!gr || !rm) return;

    const grd = gr.gameResultData as Record<string, unknown> | undefined;
    if (!grd?.actions && !grd?.roundHistory && !grd?.stages) {
      toast.error('기록 데이터가 없습니다.');
      return;
    }

    const players = (grd.players as Record<string, { nickname: string }>) ?? {};

    const record = {
      version: '1.0',
      gameId: rm.gameId,
      gameName: rm.gameName,
      playedAt: new Date().toISOString(),
      playMode: rm.playMode,
      players,
      result: {
        rankings: gr.rankings.map((r) => ({
          nickname: r.nickname,
          rank: r.rank,
          score: r.score,
        })),
        playTime: gr.playTime,
        totalTurns: gr.totalTurns,
      },
      gameRecord: buildGameRecord(rm.gameId, grd),
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
