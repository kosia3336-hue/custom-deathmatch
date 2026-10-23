import { GAME_IDS } from '../shared/types/game';
import type { GameState } from '../shared/types/events';
import { MBNW_TOTAL_ROUNDS } from '../shared/types/multiple-bnw';
import { WS_TOTAL_ROUNDS } from '../shared/types/winning-streak';
import { TOTAL_ROUNDS as NUMBER4_ROUNDS } from '../shared/types/number4';
import { SBNW_TOTAL_ROUNDS } from '../shared/types/silper-bnw';

/** 게임별 진행 단위. 새 게임 추가 시 상단 바도 함께 등록한다. */
export const GAME_PROGRESS = {
  [GAME_IDS.FOUR_GRAVITY]: 'turn',
  [GAME_IDS.DOUBLE_SIDED_CHESS]: 'turn',
  [GAME_IDS.NUMBER_FOUR]: 'round',
  [GAME_IDS.INDIAN_POKER]: 'round',
  [GAME_IDS.INVEST_DONATE]: 'round',
  [GAME_IDS.BETTING_RPS]: 'round',
  [GAME_IDS.MULTIPLE_BNW]: 'round',
  [GAME_IDS.WINNING_STREAK]: 'round',
  [GAME_IDS.BNW2]: 'round',
  [GAME_IDS.SILPER_BNW]: 'round',
  [GAME_IDS.FIVE_TOWERS]: 'turn',
  [GAME_IDS.GRAPE_SUGAR_2]: 'round',
  [GAME_IDS.SUN_MOON_STAR_2]: 'round',
  [GAME_IDS.BANK_GAME]: 'round',
  [GAME_IDS.INDIAN_POKER_EVENT]: 'event',
  [GAME_IDS.SUN_MOON_STAR_EVENT]: 'event',
  [GAME_IDS.QUATRO]: 'round',
  [GAME_IDS.WORD_PUZZLE]: 'round',
  [GAME_IDS.TRANSLETTER]: 'match',
  [GAME_IDS.NO_VOWEL]: 'match',
  [GAME_IDS.FORMULA_COMPLETION]: 'round',
  [GAME_IDS.FAREWELL_FORMULA]: 'round',
  [GAME_IDS.COMPLETE_HAP]: 'round',
  [GAME_IDS.KNIGHTS_TOUR]: 'round',
  [GAME_IDS.KINGMAKING]: 'turn',
  [GAME_IDS.TRIPLE_GOMOKU]: 'turn',
  [GAME_IDS.RANDOM]: 'selection',
  [GAME_IDS.BAN_PICK]: 'selection',
  [GAME_IDS.CHOICE_HOLDEM]: 'round',
  [GAME_IDS.SEED_SEOTDA]: 'round',
  [GAME_IDS.DOUBLE_SIDED_POKER]: 'round',
  [GAME_IDS.MYEONGCHURI]: 'round',
  [GAME_IDS.ESKIMO]: 'turn',
  [GAME_IDS.RING_THE_BELL]: 'event',
} as const;

export function progressData(state: GameState | null | undefined): Record<string, unknown> {
  return state?.gameData && typeof state.gameData === 'object'
    ? (state.gameData as Record<string, unknown>)
    : {};
}

export function getGameProgress(
  gameId: string | undefined,
  state: GameState | null | undefined,
): string | undefined {
  if (!state || !gameId) return;
  const data = progressData(state);
  const kind = GAME_PROGRESS[gameId as keyof typeof GAME_PROGRESS];
  if (kind === 'selection') return '게임 선택';
  if (kind === 'match') return '타임어택';
  if (kind === 'event') return;
  if (kind === 'turn') return `${data.turn ?? data.turnNumber ?? state.turnNumber}턴`;
  if (typeof data.round !== 'number') return;
  const fixedRounds: Record<string, number> = {
    [GAME_IDS.MULTIPLE_BNW]: MBNW_TOTAL_ROUNDS,
    [GAME_IDS.WINNING_STREAK]: WS_TOTAL_ROUNDS,
    [GAME_IDS.NUMBER_FOUR]: NUMBER4_ROUNDS,
    [GAME_IDS.SILPER_BNW]: SBNW_TOTAL_ROUNDS,
  };
  const total = data.totalRounds ?? data.maxRound ?? fixedRounds[gameId];
  return typeof total === 'number' ? `${data.round} / ${total}R` : `${data.round}R`;
}

/**
 * 상단 바의 짧은 진행 단계. 개별 게임이 더 정확한 문구를 setHud로 올리면 그 값을
 * 우선하고, 그렇지 않은 게임도 본문에 라운드 상태를 반복하지 않도록 공통 필드를 읽는다.
 */
export function getGameStatus(
  state: GameState | null | undefined,
  myId: string | undefined,
): string | undefined {
  if (!state) return;
  const data = progressData(state);
  const phase = typeof data.phase === 'string' ? data.phase : undefined;
  if (phase === 'finished' || phase === 'gameOver' || phase === 'ended') return '종료';

  const currentId = [
    data.currentPlayerId,
    data.currentTurnId,
    data.currentPlayer,
    data.turnPlayerId,
  ].find((value): value is string => typeof value === 'string');
  if (currentId && myId) return currentId === myId ? '내 차례' : '상대 차례';

  const phaseLabels: Record<string, string> = {
    setup: '준비',
    dealing: '카드 배분',
    playing: '진행 중',
    betting: '베팅',
    select: '선택',
    cardSelect: '카드 선택',
    submit: '제출',
    reveal: '공개',
    showdown: '카드 공개',
    result: '라운드 결과',
    roundResult: '라운드 결과',
    'round-result': '라운드 결과',
    thinking: '생각 시간',
  };
  return phase ? phaseLabels[phase] : undefined;
}

/** 서버가 보내는 실제 단계별 제한시간을 우선한다. null(무제한)을 보존한다. */
export function getGameClock(
  gameId: string | undefined,
  state: GameState | null | undefined,
  roomLimit: number | null,
) {
  const data = progressData(state);
  let seconds: unknown = roomLimit;
  let startedAt: unknown = state?.turnStartedAt;
  if (
    gameId === GAME_IDS.FORMULA_COMPLETION ||
    gameId === GAME_IDS.FAREWELL_FORMULA ||
    gameId === GAME_IDS.KNIGHTS_TOUR ||
    gameId === GAME_IDS.WORD_PUZZLE
  ) {
    seconds = data.roundSeconds;
    startedAt = data.phase === 'playing' ? data.roundStartedAt : null;
  } else if (gameId === GAME_IDS.COMPLETE_HAP) {
    seconds = data.matchSeconds;
    startedAt = data.phase === 'playing' ? data.matchStartedAt : null;
  } else if (gameId === GAME_IDS.TRANSLETTER || gameId === GAME_IDS.NO_VOWEL) {
    seconds = data.timeLimitSec;
    startedAt = data.phase === 'playing' ? data.startedAt : null;
  } else {
    if ('turnSeconds' in data) seconds = data.turnSeconds;
    else if ('timeLimitSeconds' in data) seconds = data.timeLimitSeconds;
    if ('turnStartedAt' in data) startedAt = data.turnStartedAt;
  }
  return {
    timeLimitSeconds: typeof seconds === 'number' && seconds > 0 ? seconds : null,
    turnStartedAt: typeof startedAt === 'number' ? startedAt : null,
  };
}
