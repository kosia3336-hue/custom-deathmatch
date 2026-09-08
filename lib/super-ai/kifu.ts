import type { GameLogPlayer, GameLogMeta } from '@/components/game/GameLogView';
import type { GameRecordFile } from '@/shared/types/archive';
import { GAME_IDS, SUPER_AI_GAMES } from '@/shared/types';

export type SuperAiGameRow = {
  id: string;
  game_id: string;
  winner_side: string | null;
  win_type: string | null;
  total_turns: number;
  play_time_seconds: number;
  ai_turns: number;
  finished: boolean;
  played_at: string;
  kifu?: unknown;
};

export function superAiGameName(gameId: string): string {
  return SUPER_AI_GAMES.find((g) => g.id === gameId)?.name ?? gameId;
}

export function superAiWinnerLabel(row: SuperAiGameRow): string {
  if (!row.finished) return '중단';
  switch (row.winner_side) {
    case 'black':
      return '흑 승';
    case 'white':
      return '백 승';
    case 'me':
      return '나 승';
    case 'opp':
      return '상대 승';
    case 'first':
      return row.game_id === GAME_IDS.NUMBER_FOUR ? '1P 승' : '선공 승';
    case 'second':
      return row.game_id === GAME_IDS.NUMBER_FOUR ? '2P 승' : '후공 승';
    case 'neutral':
      return '중립';
    case 'draw':
      return '무승부';
    default:
      return row.win_type ?? '종료';
  }
}

export function toSuperAiGameRecord(row: SuperAiGameRow): GameRecordFile {
  const kifu = (row.kifu ?? {}) as Record<string, unknown>;
  const players = (kifu.players as GameRecordFile['players']) ?? {};
  const scores =
    (kifu.finalScores as Record<string, number> | undefined) ??
    (kifu.finalChips as Record<string, number> | undefined) ??
    {};
  const rankings: GameRecordFile['result']['rankings'] = [];
  if (row.finished && (row.winner_side === 'me' || row.winner_side === 'opp')) {
    const meWin = row.winner_side === 'me';
    rankings.push({
      nickname: players.me?.nickname ?? '나',
      rank: meWin ? 1 : 2,
      score: scores.me ?? 0,
    });
    rankings.push({
      nickname: players.opp?.nickname ?? '상대',
      rank: meWin ? 2 : 1,
      score: scores.opp ?? 0,
    });
  }
  return {
    version: 'super-ai-1',
    gameId: row.game_id,
    gameName: superAiGameName(row.game_id),
    playedAt: row.played_at,
    playMode: 'solo',
    players,
    result: {
      rankings,
      playTime: row.play_time_seconds * 1000,
      totalTurns: row.total_turns,
    },
    gameRecord: kifu,
  };
}

export function toSuperAiGameLogMeta(row: SuperAiGameRow): GameLogMeta {
  return {
    gameId: row.game_id,
    gameName: superAiGameName(row.game_id),
    playedAt: row.played_at,
    playTimeMs: row.play_time_seconds * 1000,
    totalTurns: row.total_turns,
    mode: 'solo',
    countsForStats: false,
  };
}

type KifuPlayers = {
  black?: { nickname?: string };
  white?: { nickname?: string };
  first?: { nickname?: string };
  second?: { nickname?: string };
};

export function toSuperAiGameLogPlayers(row: SuperAiGameRow): GameLogPlayer[] {
  const players = ((row.kifu as { players?: KifuPlayers } | undefined)?.players) ?? {};
  const settled = row.finished && (
    row.winner_side === 'black'
    || row.winner_side === 'white'
    || row.winner_side === 'first'
    || row.winner_side === 'second'
    || row.winner_side === 'me'
    || row.winner_side === 'opp'
    || row.winner_side === 'draw'
  );
  const draw = row.finished && !settled;
  if (row.winner_side === 'draw') {
    const raw = (row.kifu as { players?: Record<string, { nickname?: string }> } | undefined)?.players ?? {};
    return [
      {
        nickname: raw.me?.nickname ?? players.first?.nickname ?? '나',
        turn: 'first',
        isWinner: false,
        isDraw: true,
        isResign: false,
      },
      {
        nickname: raw.opp?.nickname ?? players.second?.nickname ?? '상대',
        turn: 'second',
        isWinner: false,
        isDraw: true,
        isResign: false,
      },
    ];
  }

  const rawPlayers =
    (row.kifu as { players?: Record<string, { nickname?: string }> } | undefined)?.players ?? {};
  if (rawPlayers.me || rawPlayers.opp) {
    return [
      {
        nickname: rawPlayers.me?.nickname ?? '나',
        turn: 'first',
        isWinner: row.winner_side === 'me' || row.winner_side === 'first',
        isDraw: draw,
        isResign: false,
      },
      {
        nickname: rawPlayers.opp?.nickname ?? '상대',
        turn: 'second',
        isWinner: row.winner_side === 'opp' || row.winner_side === 'second',
        isDraw: draw,
        isResign: false,
      },
    ];
  }

  if (row.game_id === GAME_IDS.FOUR_GRAVITY) {
    return [
      {
        nickname: players.black?.nickname ?? '흑',
        turn: 'first',
        isWinner: row.winner_side === 'black',
        isDraw: draw,
        isResign: false,
      },
      {
        nickname: players.white?.nickname ?? '백',
        turn: 'second',
        isWinner: row.winner_side === 'white',
        isDraw: draw,
        isResign: false,
      },
    ];
  }

  if (row.game_id === GAME_IDS.NUMBER_FOUR) {
    const entries = Object.values(rawPlayers);
    return [
      {
        nickname: entries[0]?.nickname ?? '1P',
        turn: 'first',
        isWinner: row.winner_side === 'first',
        isDraw: draw,
        isResign: false,
      },
      {
        nickname: entries[1]?.nickname ?? '2P',
        turn: 'second',
        isWinner: row.winner_side === 'second',
        isDraw: draw,
        isResign: false,
      },
    ];
  }

  return [
    {
      nickname: players.first?.nickname ?? '선공',
      turn: 'first',
      isWinner: row.winner_side === 'first',
      isDraw: draw,
      isResign: false,
    },
    {
      nickname: players.second?.nickname ?? '후공',
      turn: 'second',
      isWinner: row.winner_side === 'second',
      isDraw: draw,
      isResign: false,
    },
  ];
}
