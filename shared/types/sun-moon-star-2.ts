/* ════════════════════════════════════════════════════════════════
 * 해달별2 (Sun-Moon-Star 2)
 * 10라운드 동안 빛가루를 표식(해/달/별)에 비밀 분배하고,
 * 칩을 베팅하여 점등된 표식의 2배 환급으로 승부를 가르는 2인 심리전.
 * - 빛가루 제출 : 양측 동시 비공개 (1g 단위)
 * - 표시등 갱신 : 남은 빛가루의 20g 구간만 공개
 * - 칩 베팅 : 선 → 후 턴제 공개 (후는 선의 2배 이상 강제)
 * - 점등 판정 : 합산 최다 표식 (동률 시 해 > 달 > 별 우선)
 * - 승리 : 10R 후 칩 많은 쪽, 중간 0칩 도달 시 즉시 패배
 * ════════════════════════════════════════════════════════════════ */

export const SMS2_MAX_ROUNDS = 10;
export const SMS2_INITIAL_POWDER = 100;
export const SMS2_INITIAL_CHIPS = 8;
export const SMS2_POWDER_STAGE_SIZE = 20;
export const SMS2_POWDER_STAGE_COUNT = 5;

/*
  정산 결과판 연출 시간 — 화면(MarkRevealPanel)과 서버(정산 대기)가 같은 값을 쓴다.

  예전에는 화면이 해·달·별·최종 칩·소멸 다섯 줄을 약 6초에 다 보여 주는데,
  서버는 정산 단계 수(베팅한 칸마다 하나씩 늘어난다) × 1.3초 + 2.8초를 기다린 뒤
  다음 라운드까지 3.5초를 또 기다렸다. 한 라운드 정산이 14~18초로 늘어졌고,
  그 대부분은 결과판이 다 나온 뒤 멈춰 있는 시간이었다.
  이제 한 줄씩 SMS2_REVEAL_ROW_GAP_MS 간격으로 띄우고, 다 뜬 뒤
  SMS2_RESOLVE_READ_HOLD_MS 만큼 읽을 시간을 준다.
*/
export const SMS2_REVEAL_FIRST_ROW_MS = 300;
export const SMS2_REVEAL_ROW_GAP_MS = 800;
/** 한 줄이 떠오르는 애니메이션 길이 — mark-reveal.module.css 의 revealRow 와 같게 */
export const SMS2_REVEAL_ROW_ANIM_MS = 260;
/** 결과판 줄 순서: 해·달·별(0~2), 최종 칩(3), 빛가루 소멸(4) */
export function sms2RevealRowDelay(index: number): number {
  return SMS2_REVEAL_FIRST_ROW_MS + index * SMS2_REVEAL_ROW_GAP_MS;
}
/** 결과판 마지막 줄까지 다 보이는 시점 */
export const SMS2_REVEAL_DONE_MS = sms2RevealRowDelay(4) + SMS2_REVEAL_ROW_ANIM_MS;
/** 다 보인 뒤 읽을 시간 */
export const SMS2_RESOLVE_READ_HOLD_MS = 1800;

/* ───────── 표식 ───────── */

export const MARK_IDS = ['sun', 'moon', 'star'] as const;
export type SMS2MarkId = typeof MARK_IDS[number];

export const MARK_LABELS: Record<SMS2MarkId, string> = {
  sun: '해',
  moon: '달',
  star: '별',
};

export const MARK_ICONS: Record<SMS2MarkId, string> = {
  sun: '',
  moon: '',
  star: '',
};

/** 동률 시 우선순위 (낮을수록 우선) */
export const MARK_PRIORITY: Record<SMS2MarkId, number> = {
  sun: 1,
  moon: 2,
  star: 3,
};

/* ───────── 페이즈 / 사이드 ───────── */

export type SMS2Phase =
  | 'powder'        // P1 — 양측 빛가루 제출 (동시 비공개)
  | 'betFirst'      // P3-A — 선 칩 베팅 (공개)
  | 'betSecond'     // P3-B — 후 칩 베팅 (공개, 선 베팅 열람 후)
  | 'resolve'       // P4 — 점등 판정 + 정산 애니메이션
  | 'roundEnd'      // 라운드 종료, 다음 라운드 대기
  | 'finished';     // 최종 결과

export type SMS2Side = 'p1' | 'p2';
export type SMS2WinType =
  | 'chips'         // 10R 후 칩 차이
  | 'elimination'   // 중간 0칩 도달
  | 'draw'          // 동점 무승부 (10R 후 또는 동시 0칩)
  | 'suddenDeath'   // 서든데스 승부
  | 'timeout'       // 연속 타임아웃 패배
  | 'abandon'       // 기권/퇴장
  | null;

/** 표시등 단계 (1=0~20g ... 5=81~100g) */
export type SMS2PowderStage = 1 | 2 | 3 | 4 | 5;

/* ───────── 액션 ───────── */

export interface SMS2PowderSubmission {
  sun: number;
  moon: number;
  star: number;
}

export interface SMS2ChipBet {
  sun: number;
  moon: number;
  star: number;
}

export type SMS2Action =
  | { type: 'submitPowder'; powder: SMS2PowderSubmission }
  | { type: 'cancelPowder' }
  | { type: 'submitBet'; bet: SMS2ChipBet }
  | { type: 'cancelBet' }
  | { type: 'nextRoundReady' };

/* ───────── 정산 단계 이벤트 ───────── */

export type SMS2ResolveStep =
  | {
      type: 'betReveal';
      firstSide: SMS2Side;
      firstBet: SMS2ChipBet;
      secondSide: SMS2Side;
      secondBet: SMS2ChipBet;
    }
  | {
      type: 'litDecision';
      litMark: SMS2MarkId;
      /** 동률로 우선순위에 의해 결정됐는가 */
      tieBreak: boolean;
      /**
       * 판정에 사용된 각 표식 합산(양쪽 빛가루를 더한 값).
       * 게임 중에는 보내지 않는다 — 내 기여를 빼면 상대가 어디에 몇 g 넣었는지가
       * 드러난다. 룰상 공개는 '남은 빛가루의 20g 구간' 뿐이다. 끝난 뒤(기록)에만 채운다.
       */
      totals?: { sun: number; moon: number; star: number };
    }
  | {
      type: 'payout';
      side: SMS2Side;
      mark: SMS2MarkId;
      staked: number;
      returned: number;
    }
  | {
      type: 'forfeit';
      side: SMS2Side;
      mark: SMS2MarkId;
      amount: number;
    }
  | {
      type: 'powderBurn';
      mark: SMS2MarkId;
      /** 소멸된 합산량 — totals 와 같은 이유로 게임 중에는 보내지 않는다 */
      total?: number;
    }
  | {
      type: 'roundSummary';
      chipAfter: { p1: number; p2: number };
      chipDelta: { p1: number; p2: number };
      stageBefore: { p1: SMS2PowderStage; p2: SMS2PowderStage };
      stageAfter: { p1: SMS2PowderStage; p2: SMS2PowderStage };
    };

/* ───────── 플레이어 공개 상태 ───────── */

export interface SMS2PlayerPublic {
  id: string;
  nickname: string;
  side: SMS2Side;
  chips: number;
  powderStage: SMS2PowderStage;
  submittedPowder: boolean;
  betConfirmed: boolean;
  /** 공개 베팅 (확정 후): betFirst 확정 → 선의 bet, betSecond 확정 → 후의 bet */
  publicBet: SMS2ChipBet | null;
}

/* ───────── 본인 전용 비공개 상태 ───────── */

export interface SMS2SelfPrivate {
  side: SMS2Side;
  /** 정확한 빛가루 잔량 (본인만) */
  powderRemain: number;
  /** 제출 pending 상태 (취소 가능 시점 참조용) */
  pendingPowder: SMS2PowderSubmission | null;
  pendingBet: SMS2ChipBet | null;
  /** 표식별 본인 누적 기여 */
  myMarkContribution: { sun: number; moon: number; star: number };
}

/* ───────── 라운드 기록 ───────── */

export interface SMS2RoundRecord {
  round: number;
  firstPlayerSide: SMS2Side;
  /** 게임 진행 중 관전자/상대에게는 마스킹하여 전송 */
  powderSubmission: { p1: SMS2PowderSubmission; p2: SMS2PowderSubmission };
  markTotalsBefore: { sun: number; moon: number; star: number };
  markTotalsAfter: { sun: number; moon: number; star: number };
  bets: { p1: SMS2ChipBet; p2: SMS2ChipBet };
  firstBetTotal: number;
  secondBetTotal: number;
  litMark: SMS2MarkId;
  tieBreak: boolean;
  chipDelta: { p1: number; p2: number };
  chipAfter: { p1: number; p2: number };
  /** 이 라운드 빛가루 제출 이전의 단계 */
  stageBefore: { p1: SMS2PowderStage; p2: SMS2PowderStage };
  stageAfter: { p1: SMS2PowderStage; p2: SMS2PowderStage };
  auto: { p1: boolean; p2: boolean };
}

/* ───────── 게임 데이터 (game:state.gameData) ───────── */

export interface SMS2GameData {
  phase: SMS2Phase;
  round: number;
  maxRound: number;
  suddenDeath: boolean;
  firstPlayerSide: SMS2Side;
  players: { p1: SMS2PlayerPublic; p2: SMS2PlayerPublic };
  /** 본인 전용 비공개 정보 — 서버는 본인 소켓에만 채워서 전송 */
  selfPrivate: SMS2SelfPrivate | null;
  /** resolve 페이즈의 애니메이션 스텝 */
  resolveSteps?: SMS2ResolveStep[];
  /** roundEnd 페이즈의 결과 기록 */
  roundResult?: SMS2RoundRecord;
  /** 이력 (클라이언트 목적별로 마스킹하여 전송) */
  history: SMS2RoundRecord[];
  finalWinner: SMS2Side | 'draw' | null;
  winType: SMS2WinType;
  isFinalRound: boolean;
}

/* ───────── 헬퍼 ───────── */

export function powderStageOf(remain: number): SMS2PowderStage {
  if (remain <= 20) return 1;
  if (remain <= 40) return 2;
  if (remain <= 60) return 3;
  if (remain <= 80) return 4;
  return 5;
}

export function powderStageRange(stage: SMS2PowderStage): { min: number; max: number } {
  switch (stage) {
    case 1: return { min: 0, max: 20 };
    case 2: return { min: 21, max: 40 };
    case 3: return { min: 41, max: 60 };
    case 4: return { min: 61, max: 80 };
    case 5: return { min: 81, max: 100 };
  }
}

export function firstMaxBet(opponentChips: number): number {
  return Math.max(0, Math.floor(opponentChips / 2));
}

export function secondMinBet(firstTotal: number): number {
  return firstTotal <= 0 ? 0 : firstTotal * 2;
}

export function decideLitMark(totals: { sun: number; moon: number; star: number }): {
  mark: SMS2MarkId;
  tieBreak: boolean;
} {
  const max = Math.max(totals.sun, totals.moon, totals.star);
  const orderedMarks: SMS2MarkId[] = ['sun', 'moon', 'star'];
  const winners = orderedMarks.filter((m) => totals[m] === max);
  return { mark: winners[0], tieBreak: winners.length > 1 };
}

export function zeroBet(): SMS2ChipBet {
  return { sun: 0, moon: 0, star: 0 };
}

export function zeroPowder(): SMS2PowderSubmission {
  return { sun: 0, moon: 0, star: 0 };
}

export function sumBet(bet: SMS2ChipBet): number {
  return bet.sun + bet.moon + bet.star;
}

export function sumPowder(p: SMS2PowderSubmission): number {
  return p.sun + p.moon + p.star;
}

/** 초반 올인 금지. R1 p90=27. 마지막 라운드만 잔여 전부. */
export function sms2PowderSoftCap(remain: number, roundsLeft: number): number {
  if (remain <= 0) return 0;
  if (roundsLeft <= 1) return remain;
  if (roundsLeft >= 7) return Math.min(remain, 27);
  if (roundsLeft >= 5) return Math.min(remain, 22);
  if (roundsLeft >= 3) return Math.min(remain, 20);
  return remain;
}

/** 표시등 단계를 안 떨어뜨리는 최대 지출. 잔여 100 → 19. */
export function sms2StageKeepSpend(remain: number): number {
  if (remain <= 0) return 0;
  const { min } = powderStageRange(powderStageOf(remain));
  return Math.max(0, remain - min);
}

export function sms2FocusPowder(mark: SMS2MarkId, amount: number): SMS2PowderSubmission {
  const p = zeroPowder();
  p[mark] = Math.max(0, amount);
  return p;
}

export function sms2FocusBet(mark: SMS2MarkId, amount: number): SMS2ChipBet {
  const b = zeroBet();
  b[mark] = Math.max(0, amount);
  return b;
}

export function sms2ApplyChipDelta(chips: number, bet: SMS2ChipBet, lit: SMS2MarkId): number {
  return chips + 2 * bet[lit] - sumBet(bet);
}

export function sms2IsPowderStage(n: unknown): n is SMS2PowderStage {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5;
}

/** 단계 변화로 가능한 지출 구간. 정확 잔량은 모른다. */
export function sms2SpentByStage(
  stageBefore: SMS2PowderStage,
  stageAfter: SMS2PowderStage,
): { min: number; max: number } {
  const b = powderStageRange(stageBefore);
  const a = powderStageRange(stageAfter);
  return {
    min: Math.max(0, b.min - a.max),
    max: Math.max(0, b.max - a.min),
  };
}
