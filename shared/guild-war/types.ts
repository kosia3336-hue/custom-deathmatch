/**
 * 링 더 벨 (길드전) 엔진 공용 타입.
 * 서버 권위 엔진과 데브 프리뷰(`/dev/guild-war`)가 같이 쓴다.
 */

export const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type ColorId = (typeof COLORS)[number];

export const COLOR_LABEL: Record<ColorId, string> = {
  red: '빨강',
  orange: '주황',
  yellow: '노랑',
  green: '초록',
  blue: '파랑',
  purple: '보라',
};

export const TURN_MS = 30_000;
export const COMBO_MS = 30_000;
export const COUNTDOWN_MS = 15_000;
export const ANTE = 3;
/** 데브 프리뷰 시작 칩. 운영은 길드 금고에서 온다. */
export const START_CHIPS = 50;

export const RTB_MAX_SEATS = 8;
export const RTB_MIN_PLAYERS = 3;
/** 한 방에 앉을 수 있는 같은 길드 인원. */
export const RTB_MAX_PER_GUILD = 3;

export interface RtbCard {
  id: string;
  color: ColorId;
  rank: number;
}

export type RtbPhase =
  | 'turn'
  | 'pick_source'
  | 'discard'
  | 'four_choice'
  | 'last_swap'
  | 'combo'
  | 'settle'
  | 'countdown'
  | 'idle';

export interface RtbPlayer {
  id: string;
  nickname: string;
  guildId: string;
  guildName: string;
  guildMarkUrl: string;
  isBot: boolean;
}

export interface RtbGuild {
  id: string;
  name: string;
  markUrl: string;
  balance: number;
  snapshot: number;
  spent: number;
}

/** 엔진이 내는 강퇴 사유. 매니저가 안내 문구로 바꾼다. */
export type RtbKickReason = 'turn_timeout' | 'combo_timeout' | 'ante';

export interface RtbKick {
  playerId: string;
  reason: RtbKickReason;
}

export interface SettleWinner {
  playerId: string;
  guildId: string;
  amount: number;
}

export interface SettleLine {
  playerId: string;
  nickname: string;
  guildName: string;
  guildMarkUrl: string;
  combo: RtbCard[] | null;
  score: number | null;
  rank: number | null;
  timedOut: boolean;
  died: boolean;
  isBell: boolean;
}

export interface SettleResult {
  kind: 'bell_success' | 'bell_fail' | 'first' | 'last_alive' | 'extinct' | 'four';
  potBefore: number;
  winners: SettleWinner[];
  vanished: number;
  lines: SettleLine[];
  note: string;
  /** 세트 시작 스냅샷 대비 길드별 증감. DB 정산에 그대로 넘긴다. */
  guildDeltas: Record<string, number>;
}

export interface RtbState {
  setIndex: number;
  phase: RtbPhase;
  roster: RtbPlayer[];
  players: RtbPlayer[];
  guilds: Record<string, RtbGuild>;
  pot: number;
  deck: RtbCard[];
  face: RtbCard | null;
  hands: Record<string, RtbCard[]>;
  alive: Record<string, boolean>;
  combo: Record<string, RtbCard[] | undefined>;
  comboTimedOut: Record<string, boolean>;
  currentId: string | null;
  bellId: string | null;
  lastSwapQueue: string[];
  firstId: string | null;
  nextFirstId: string | null;
  /**
   * 엔진이 「로비로 강퇴해야 한다」고 판정한 좌석 (§13.4).
   * 매니저가 읽어 내보내고 비운다. 엔진은 소켓을 모르므로 여기에 적어 넘긴다.
   */
  pendingKick: RtbKick[];
  turnEndsAt: number | null;
  comboEndsAt: number | null;
  countdownEndsAt: number | null;
  settle: SettleResult | null;
  log: string[];
  revealAll: boolean;
}

export type RtbAction =
  | { type: 'swap' }
  | { type: 'pick'; source: 'deck' | 'face' }
  | { type: 'discard'; cardId: string }
  | { type: 'four' }
  | { type: 'skip_four' }
  | { type: 'die' }
  | { type: 'bell' }
  | { type: 'combo'; cardIds: string[] }
  | { type: 'timeout' }
  | { type: 'start_set' }
  | { type: 'begin_countdown' }
  | { type: 'refill'; amount: number }
  | { type: 'toggle_reveal' };

export type ApplyResult = { ok: true; state: RtbState } | { ok: false; error: string };
