/**
 * 슈퍼 AI 전용 기보. 운영 game_logs / record_game_end / 전적에 넣지 않는다.
 */
import type { GameResult } from '@shared/types/events.js';
import { GAME_IDS } from '@shared/types/game.js';
import type { Player, Room } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import {
  buildNf4AdvisorKifu,
  type Nf4AdvisorResult,
  type Nf4AdvisorRound,
  type Nf4AdvisorWinner,
} from '@shared/numberFourAdvisor.js';
import {
  buildBrpsAdvisorKifu,
  type BrpsAdvisorResult,
  type BrpsAdvisorRound,
} from '@shared/types/betting-rps.js';
import {
  buildMbnwAdvisorKifu,
  type MbnwAdvisorResult,
  type MbnwAdvisorRound,
} from '@shared/types/multiple-bnw.js';
import {
  buildWsAdvisorKifu,
  type WsAdvisorResult,
  type WsAdvisorRound,
  type WSWinType,
} from '@shared/types/winning-streak.js';
import {
  buildBnw2AdvisorKifu,
  type Bnw2AdvisorResult,
  type Bnw2AdvisorRound,
  type BNW2WinType,
} from '@shared/types/bnw2.js';
import {
  buildSbnwAdvisorKifu,
  type SbnwAdvisorResult,
  type SbnwAdvisorRound,
  type SBNWWinType,
} from '@shared/types/silper-bnw.js';
import {
  buildFtAdvisorKifu,
  type FtAdvisorPly,
  type FtAdvisorResult,
  type FTWinType,
} from '@shared/types/five-towers.js';
import { buildGs2AdvisorKifu } from '@shared/types/grape-sugar-2-advisor.js';
import type { Gs2AdvisorRound, Gs2AdvisorResult, GS2WinType } from '@shared/types/grape-sugar-2.js';
import {
  buildSms2AdvisorKifu,
  type Sms2AdvisorResult,
  type Sms2AdvisorRound,
} from '@shared/types/sun-moon-star-2-advisor.js';
import type { SMS2WinType } from '@shared/types/sun-moon-star-2.js';
import {
  buildBankAdvisorKifu,
  type BankAdvisorResult,
  type BankAdvisorRound,
} from '@shared/types/bank-game-advisor.js';
import type { BankWinType } from '@shared/types/bank-game.js';
import {
  buildQuatroAdvisorKifu,
  type QuatroAdvisorPly,
  type QuatroAdvisorResult,
} from '@shared/types/quatro-advisor.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';

const SUPER_ENGINE = { kind: 'super', thinkMs: 90_000 } as const;

type PersistOpts = {
  finished: boolean;
};

type KifuShape = {
  winType?: string | null;
  players?: {
    black?: { nickname?: string };
    white?: { nickname?: string };
    first?: { nickname?: string };
    second?: { nickname?: string };
  };
  actions?: Array<{ byAi?: boolean }>;
};

export function countAiTurns(kifu: unknown): number {
  const actions = (kifu as KifuShape | null)?.actions;
  if (!Array.isArray(actions)) return 0;
  let n = 0;
  for (const a of actions) {
    if (a.byAi === true) n += 1;
    const players = (a as { players?: Record<string, { byAi?: boolean }> }).players;
    if (players) {
      for (const p of Object.values(players)) {
        if (p?.byAi === true) n += 1;
      }
    }
  }
  return n;
}

export function winnerSideFromKifu(
  gameId: string,
  kifu: unknown,
  rankings: GameResult['rankings'],
): string | null {
  const data = (kifu ?? {}) as KifuShape;
  if (gameId === GAME_IDS.FOUR_GRAVITY) {
    return data.winType ?? null;
  }
  if (gameId === GAME_IDS.DOUBLE_SIDED_CHESS) {
    const winner = rankings.find((r) => r.rank === 1);
    if (!winner) return null;
    if (winner.nickname === data.players?.first?.nickname) return 'first';
    if (winner.nickname === data.players?.second?.nickname) return 'second';
    return null;
  }
  if (gameId === GAME_IDS.NUMBER_FOUR) {
    const winner = rankings.find((r) => r.rank === 1);
    if (!winner) return null;
    const players = (kifu as { players?: Record<string, { nickname?: string }> } | null)?.players ?? {};
    const ids = Object.keys(players);
    if (winner.playerId && ids.includes(winner.playerId)) {
      return ids[0] === winner.playerId ? 'first' : 'second';
    }
    const nick = winner.nickname;
    if (ids[0] && players[ids[0]]?.nickname === nick) return 'first';
    if (ids[1] && players[ids[1]]?.nickname === nick) return 'second';
    if (nick?.includes('(1P)')) return 'first';
    if (nick?.includes('(2P)')) return 'second';
    return 'first';
  }
  return null;
}

function actionCount(kifu: unknown): number {
  const actions = (kifu as KifuShape | null)?.actions;
  return Array.isArray(actions) ? actions.length : 0;
}

export async function persistSuperAiGame(
  room: Room,
  result: GameResult,
  opts: PersistOpts,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  if (room.gameOptions?.superAi !== true) return null;

  const kifu = result.gameResultData ?? {};
  if (!opts.finished && actionCount(kifu) === 0) return null;

  const memberId =
    room.players.find((p: Player) => p.memberId && p.id !== AI_PLAYER_ID)?.memberId ?? null;
  if (!memberId) return null;

  const winType = opts.finished
    ? ((kifu as KifuShape).winType ?? null)
    : 'abandoned';
  const winnerSide = opts.finished
    ? winnerSideFromKifu(room.gameId, kifu, result.rankings)
    : null;

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: room.gameId,
    member_id: memberId,
    room_id: room.id,
    winner_side: winnerSide,
    win_type: winType,
    total_turns: result.totalTurns ?? 0,
    play_time_seconds: Math.max(0, Math.floor(result.playTime / 1000)),
    ai_turns: countAiTurns(kifu),
    finished: opts.finished,
    kifu,
    engine: SUPER_ENGINE,
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistNumberFourAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  history: Nf4AdvisorRound[];
  winner: Nf4AdvisorWinner;
  result: Nf4AdvisorResult;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildNf4AdvisorKifu({
    history: opts.history,
    myNickname: opts.nickname,
    winner: opts.winner,
    result: opts.result,
  });

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.NUMBER_FOUR,
    member_id: opts.memberId,
    room_id: null,
    winner_side: opts.winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistBettingRpsAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: BrpsAdvisorRound[];
  result: BrpsAdvisorResult;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildBrpsAdvisorKifu({
    history: opts.history,
    iAmFirst: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.BETTING_RPS,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistMultipleBnwAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: MbnwAdvisorRound[];
  result: MbnwAdvisorResult;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildMbnwAdvisorKifu({
    history: opts.history,
    iAmFirstStart: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.MULTIPLE_BNW,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistWinningStreakAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  history: WsAdvisorRound[];
  result: WsAdvisorResult;
  winType: WSWinType;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildWsAdvisorKifu({
    history: opts.history,
    myNickname: opts.nickname,
    result: opts.result,
    winType: opts.winType,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.WINNING_STREAK,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistBnw2AdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: Bnw2AdvisorRound[];
  result: Bnw2AdvisorResult;
  winType: BNW2WinType | null;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildBnw2AdvisorKifu({
    history: opts.history,
    iAmFirstStart: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
    winType: opts.winType,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.BNW2,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistSilperBnwAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: SbnwAdvisorRound[];
  result: SbnwAdvisorResult;
  winType: SBNWWinType | null;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildSbnwAdvisorKifu({
    history: opts.history,
    iAmFirstStart: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
    winType: opts.winType,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.SILPER_BNW,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistFiveTowersAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: FtAdvisorPly[];
  result: FtAdvisorResult;
  winType: FTWinType | null;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildFtAdvisorKifu({
    history: opts.history,
    iAmFirst: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
    winType: opts.winType,
  });
  const winner = opts.result.kind === 'win' ? 'me' : 'opp';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.FIVE_TOWERS,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistGrapeSugar2AdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  history: Gs2AdvisorRound[];
  result: Gs2AdvisorResult;
  winType: GS2WinType;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildGs2AdvisorKifu({
    history: opts.history,
    myNickname: opts.nickname,
    result: opts.result,
    winType: opts.winType,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.GRAPE_SUGAR_2,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistSunMoonStar2AdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: Sms2AdvisorRound[];
  result: Sms2AdvisorResult;
  winType: SMS2WinType;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildSms2AdvisorKifu({
    history: opts.history,
    iAmFirstStart: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
    winType: opts.winType,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.SUN_MOON_STAR_2,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistBankGameAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: BankAdvisorRound[];
  result: BankAdvisorResult;
  winType: BankWinType;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildBankAdvisorKifu({
    history: opts.history,
    iAmFirstStart: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
    winType: opts.winType,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}

export async function persistQuatroAdvisorKifu(opts: {
  memberId: string;
  nickname: string;
  iAmFirst: boolean;
  history: QuatroAdvisorPly[];
  result: QuatroAdvisorResult;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const kifu = buildQuatroAdvisorKifu({
    history: opts.history,
    iAmFirstStart: opts.iAmFirst,
    myNickname: opts.nickname,
    result: opts.result,
  });
  const winner =
    opts.result.kind === 'win' ? 'me' : opts.result.kind === 'loss' ? 'opp' : 'draw';

  const sb = getSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from as any)('super_ai_games').insert({
    game_id: GAME_IDS.QUATRO,
    member_id: opts.memberId,
    room_id: null,
    winner_side: winner,
    win_type: kifu.winType,
    total_turns: opts.history.length,
    play_time_seconds: 0,
    ai_turns: countAiTurns(kifu),
    finished: true,
    kifu,
    engine: { ...SUPER_ENGINE, advisor: true },
    played_at: new Date().toISOString(),
  }).select('id').maybeSingle();

  if (error) throw new Error(error.message);
  return typeof data?.id === 'string' ? data.id : null;
}
