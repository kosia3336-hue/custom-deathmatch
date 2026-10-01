export interface Game {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  supportsMulti: boolean;
  supportsCom: boolean;
  supportsSolo: boolean;
  supportsTutorial: boolean;
  /** 랭킹 페이지 노출 + 랭크 매칭 밴픽 풀 포함 여부. false 면 새 게임을 검증 기간 동안
   *  캐주얼(비랭크) 방에서만 플레이하게 하고 랭크 큐에서는 제외할 수 있다. */
  rankingActive: boolean;
  /** 게임이 등록된 시각(ISO). 방 만들기에서 'NEW' 표시를 붙일지 판단한다.
   *  랜덤·밴픽처럼 실제 게임이 아닌 항목에는 없다. */
  createdAt?: string;
}

export const GAME_IDS = {
  FOUR_GRAVITY: 'game-001',
  DOUBLE_SIDED_CHESS: 'game-002',
  NUMBER_FOUR: 'game-003',
  INDIAN_POKER: 'game-004',
  INVEST_DONATE: 'game-005',
  BETTING_RPS: 'game-006',
  MULTIPLE_BNW: 'game-007',
  WINNING_STREAK: 'game-008',
  BNW2: 'game-009',
  SILPER_BNW: 'game-010',
  FIVE_TOWERS: 'game-011',
  GRAPE_SUGAR_2: 'game-012',
  SUN_MOON_STAR_2: 'game-013',
  BANK_GAME: 'game-014',
  INDIAN_POKER_EVENT: 'game-015',
  SUN_MOON_STAR_EVENT: 'game-016',
  QUATRO: 'game-017',
  WORD_PUZZLE: 'game-018',
  TRANSLETTER: 'game-019',
  FORMULA_COMPLETION: 'game-020',
  COMPLETE_HAP: 'game-021',
  KNIGHTS_TOUR: 'game-022',
  KINGMAKING: 'game-023',
  TRIPLE_GOMOKU: 'game-024',
  CHOICE_HOLDEM: 'game-025',
  SEED_SEOTDA: 'game-026',
  DOUBLE_SIDED_POKER: 'game-027',
  MYEONGCHURI: 'game-028',
  /** 기간 한정 길드전 「링 더 벨」. 시스템 룸 `guild-war` 전용. `games` 테이블에 없음. */
  RING_THE_BELL: 'game-029',
  RANDOM: 'random',
  BAN_PICK: 'ban-pick',
} as const;

/** 삼층 오목 등 기존 COM 난이도. 사중력·양면장기는 고민 시간(`aiThinkSeconds`)을 쓴다. */
export const ABSTRACT_AI_DIFFICULTIES = ['normal', 'hard'] as const;
export type AbstractAiDifficulty = (typeof ABSTRACT_AI_DIFFICULTIES)[number];
export const DEFAULT_ABSTRACT_AI_DIFFICULTY: AbstractAiDifficulty = 'normal';

/** 임시 운영 중지. 재개 시 이 목록에서 해당 게임만 제거한다. */
export const PAUSED_HARD_AI_GAME_IDS: readonly string[] = [GAME_IDS.FOUR_GRAVITY, GAME_IDS.DOUBLE_SIDED_CHESS];

export function resolveAbstractAiDifficulty(value: unknown, gameId?: string): AbstractAiDifficulty {
  if (gameId && PAUSED_HARD_AI_GAME_IDS.includes(gameId)) return 'normal';
  return value === 'hard' ? 'hard' : DEFAULT_ABSTRACT_AI_DIFFICULTY;
}

/** `/super-ai` 허브에 올리는 게임. 넘버4·베팅 가위바위보·배수 흑과 백·연승·흑과백2·실퍼의 흑과백·5개의 탑·포도설탕2·해달별2·은행놀이·콰트로는 자문, 사목·양면은 솔로 방. */
export const SUPER_AI_GAMES = [
  { id: GAME_IDS.FOUR_GRAVITY, name: '사중력 사목' },
  { id: GAME_IDS.DOUBLE_SIDED_CHESS, name: '양면장기' },
  { id: GAME_IDS.NUMBER_FOUR, name: '넘버4' },
  { id: GAME_IDS.BETTING_RPS, name: '베팅! 가위바위보' },
  { id: GAME_IDS.MULTIPLE_BNW, name: '배수 흑과 백' },
  { id: GAME_IDS.WINNING_STREAK, name: '연승게임' },
  { id: GAME_IDS.BNW2, name: '흑과백2' },
  { id: GAME_IDS.SILPER_BNW, name: '실퍼의 흑과백' },
  { id: GAME_IDS.FIVE_TOWERS, name: '5개의 탑' },
  { id: GAME_IDS.GRAPE_SUGAR_2, name: '포도설탕2' },
  { id: GAME_IDS.SUN_MOON_STAR_2, name: '해달별2' },
  { id: GAME_IDS.BANK_GAME, name: '은행놀이' },
  { id: GAME_IDS.QUATRO, name: '콰트로' },
] as const;

export function superAiAdvisorHref(gameId: string | null | undefined): string | null {
  if (gameId === GAME_IDS.NUMBER_FOUR) return '/super-ai/number4';
  if (gameId === GAME_IDS.BETTING_RPS) return '/super-ai/betting-rps';
  if (gameId === GAME_IDS.MULTIPLE_BNW) return '/super-ai/multiple-bnw';
  if (gameId === GAME_IDS.WINNING_STREAK) return '/super-ai/winning-streak';
  if (gameId === GAME_IDS.BNW2) return '/super-ai/bnw2';
  if (gameId === GAME_IDS.SILPER_BNW) return '/super-ai/silper-bnw';
  if (gameId === GAME_IDS.FIVE_TOWERS) return '/super-ai/five-towers';
  if (gameId === GAME_IDS.GRAPE_SUGAR_2) return '/super-ai/grape-sugar-2';
  if (gameId === GAME_IDS.SUN_MOON_STAR_2) return '/super-ai/sun-moon-star-2';
  if (gameId === GAME_IDS.BANK_GAME) return '/super-ai/bank-game';
  if (gameId === GAME_IDS.QUATRO) return '/super-ai/quatro';
  return null;
}

/** 솔로 방 + 슈퍼 토글. 넘버4는 여기 없다. */
export const SUPER_AI_MATCH_GAMES = [
  { id: GAME_IDS.FOUR_GRAVITY, name: '사중력 사목' },
  { id: GAME_IDS.DOUBLE_SIDED_CHESS, name: '양면장기' },
] as const;

export function supportsSuperAi(gameId: string | null | undefined): boolean {
  return SUPER_AI_GAMES.some((game) => game.id === gameId);
}

export function supportsSuperAiMatch(gameId: string | null | undefined): boolean {
  return SUPER_AI_MATCH_GAMES.some((game) => game.id === gameId);
}

export function isSuperAiGameOptions(
  gameOptions: Record<string, unknown> | null | undefined,
): boolean {
  return gameOptions?.superAi === true;
}

/** 사중력 사목·양면장기 COM이 한 수에 쓸 탐색 예산(초). 기본 5초, 최대 3분. */
export const MIN_ABSTRACT_AI_THINK_SECONDS = 5;
export const MAX_ABSTRACT_AI_THINK_SECONDS = 180;
export const DEFAULT_ABSTRACT_AI_THINK_SECONDS = 5;

export function resolveAbstractAiThinkSeconds(
  gameOptions?: Record<string, unknown> | null,
): number {
  const raw = gameOptions?.aiThinkSeconds;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.min(
      MAX_ABSTRACT_AI_THINK_SECONDS,
      Math.max(MIN_ABSTRACT_AI_THINK_SECONDS, Math.round(raw)),
    );
  }
  // 예전 `어려움` 방: 강한 엔진 30초에 맞추던 예산을 노말 엔진에 그대로 넘긴다.
  if (gameOptions?.aiDifficulty === 'hard') return 30;
  return DEFAULT_ABSTRACT_AI_THINK_SECONDS;
}

export function formatAbstractAiThinkSeconds(seconds: number): string {
  const n = resolveAbstractAiThinkSeconds({ aiThinkSeconds: seconds });
  const m = Math.floor(n / 60);
  const s = n % 60;
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}

export function isAbstractStrategyGameId(gameId: string | null | undefined): boolean {
  return gameId === GAME_IDS.FOUR_GRAVITY || gameId === GAME_IDS.DOUBLE_SIDED_CHESS;
}
