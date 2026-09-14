/* ════════════════════════════════════════════════════════════════
 * 은행놀이 (Bank Game)
 * 9라운드 동안 4종 지폐(1,000 / 3,000 / 5,000 / 10,000원)를 비공개 베팅하여
 * 더 많은 금액을 제출한 쪽이 승점을 가져가는 2인 정보 비대칭 심리전.
 *
 *   ① 선 제출(비공개) → ② 선 장수 공개 → ③ 후 제출(비공개) → ④ 정산
 *   - 라운드 승자 +1, 패자 0 (동률 시 양측 0)
 *   - 패자 금액만 양측 공개, 승자 금액은 게임 종료까지 비공개
 *     (단, 사후 기록실에서는 전체 공개)
 *   - 선/후는 매 라운드 무조건 교대
 * ════════════════════════════════════════════════════════════════ */

export const BANK_TOTAL_ROUNDS = 9;

/* ───────── 액면 ───────── */

export const BANK_DENOMINATIONS = [1000, 3000, 5000, 10000] as const;
export type BankDenomination = typeof BANK_DENOMINATIONS[number];

/** 시작 인벤토리 (양측 동일, 합 38장 / 100,000원) */
export const BANK_INITIAL_INVENTORY: Record<BankDenomination, number> = {
  1000: 20,
  3000: 10,
  5000: 6,
  10000: 2,
};

export const BANK_INITIAL_TOTAL_COUNT = 38;
export const BANK_INITIAL_TOTAL_AMOUNT = 100_000;

/* ───────── 페이즈 / 사이드 ───────── */

export type BankPhase =
  | 'firstSubmit'   // ① 선 제출 (선만 입력)
  | 'firstReveal'   // ② 선의 장수 공개 (1.2초 배너)
  | 'secondSubmit'  // ③ 후 제출 (후만 입력)
  | 'reveal'        // ④ 정산 애니메이션
  | 'roundEnd'      // 라운드 결과 표시 후 다음 라운드 대기
  | 'finished';     // 최종 결과

export type BankSide = 'p1' | 'p2';

export type BankWinType =
  | 'score'         // 9R 종료 후 승점 비교
  | 'draw'          // 9R 종료 후 승점 동률
  | 'timeout'       // 연속 타임아웃 패배
  | 'leave'         // 자발적 기권 / 재연결 실패
  | null;

/* ───────── 베팅 ───────── */

export type BankBet = Record<BankDenomination, number>;

export function zeroBet(): BankBet {
  return { 1000: 0, 3000: 0, 5000: 0, 10000: 0 };
}

export function emptyInventory(): BankBet {
  return zeroBet();
}

export function initialInventory(): BankBet {
  return { ...BANK_INITIAL_INVENTORY };
}

export function sumBetCount(b: BankBet): number {
  return b[1000] + b[3000] + b[5000] + b[10000];
}

export function sumBetAmount(b: BankBet): number {
  return b[1000] * 1000 + b[3000] * 3000 + b[5000] * 5000 + b[10000] * 10000;
}

export function sumInventoryCount(inv: BankBet): number {
  return sumBetCount(inv);
}

export function sumInventoryAmount(inv: BankBet): number {
  return sumBetAmount(inv);
}

/** 두 베팅 비교: 1 = a 승, -1 = b 승, 0 = 동률 */
export function compareBetAmount(a: BankBet, b: BankBet): 1 | -1 | 0 {
  const av = sumBetAmount(a);
  const bv = sumBetAmount(b);
  if (av > bv) return 1;
  if (av < bv) return -1;
  return 0;
}

/** 인벤토리에서 베팅을 차감해 새 인벤토리 반환 */
export function subtractInventory(inv: BankBet, bet: BankBet): BankBet {
  return {
    1000: inv[1000] - bet[1000],
    3000: inv[3000] - bet[3000],
    5000: inv[5000] - bet[5000],
    10000: inv[10000] - bet[10000],
  };
}

/** 베팅 검증: 모든 액면 ≥ 0 정수, 인벤토리 이내 */
export function validateBet(bet: BankBet, inv: BankBet): { ok: true } | { ok: false; reason: string } {
  for (const d of BANK_DENOMINATIONS) {
    const v = bet[d];
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) {
      return { ok: false, reason: `${d}원 베팅 값이 정수가 아닙니다.` };
    }
    if (v < 0) {
      return { ok: false, reason: `${d}원 베팅 값이 음수입니다.` };
    }
    if (v > inv[d]) {
      return { ok: false, reason: `${d}원 보유량(${inv[d]}장)을 초과했습니다.` };
    }
  }
  return { ok: true };
}

/* ───────── 액션 ───────── */

export type BankAction =
  | { type: 'submitBet'; bet: BankBet }
  | { type: 'cancelBet' }
  | { type: 'skipReveal' }     // reveal/roundEnd 페이즈에서 즉시 다음 라운드 진행
  | { type: 'nextRoundReady' };

/* ───────── 정산 단계 이벤트 ───────── */

export type BankResolveStep =
  | {
      type: 'flipLoser';
      side: BankSide;
      amount: number;
      count: number;
    }
  | {
      type: 'flipBoth';     // 동률
      firstAmount: number;
      secondAmount: number;
      firstCount: number;
      secondCount: number;
    }
  | {
      type: 'crownWinner';
      side: BankSide;
      count: number;
      /** 승자 본인에게만 보낼 금액 (서버는 본인 소켓에만 채워서 전송) */
      privateAmount?: number;
    }
  | {
      type: 'roundSummary';
      scoreAfter: { p1: number; p2: number };
      scoreDelta: { p1: number; p2: number };
      inventoryTotalAfter: { p1: number; p2: number };
    };

/* ───────── 플레이어 공개 상태 ───────── */

export interface BankPlayerInfo {
  id: string;
  nickname: string;
  side: BankSide;
  /** 승점 */
  score: number;
  /** 잔여 총 장수 (공개) */
  inventoryCount: number;
  /** 자기 자신은 인벤토리 액면별 수량을 보유. 상대용 페이로드는 null 마스킹 */
  inventory: BankBet | null;
  /** 자기 잔여 총 금액 (본인만, 상대는 null) */
  inventoryAmount: number | null;
  /** 이번 라운드 베팅 확정 여부 (공개) */
  betConfirmed: boolean;
  /** 이번 라운드 베팅 장수 (firstReveal 이후 또는 secondSubmit 이후 공개) */
  publicBetCount: number | null;
  /** 자기 시점에서만 자기 베팅의 정확한 조합 (상대는 null) */
  selfBet: BankBet | null;
}

/* ───────── 라운드 정보 (게임 중) ───────── */

/**
 * 게임 진행 중에 클라이언트로 보내는 라운드 결과.
 * 정보 비대칭을 보존하기 위해 승자의 정확한 금액은 본인을 제외하면 null.
 */
export interface BankRoundResult {
  round: number;
  firstSide: BankSide;
  outcome: 'first_win' | 'second_win' | 'draw';
  /** 승자 사이드 (동률은 null) */
  winnerSide: BankSide | null;
  /** 패자 사이드 (동률은 null) */
  loserSide: BankSide | null;
  /** 양측 베팅 장수 (공개) */
  firstCount: number;
  secondCount: number;
  /**
   * 양측 베팅 금액. 동률이면 둘 다 채워져 있고,
   * 그 외 케이스는 패자 금액만 채워지고 승자 금액은 null.
   * (단 viewer가 승자 본인이라면 본인의 금액은 채워서 전송)
   */
  firstAmount: number | null;
  secondAmount: number | null;
  /** 자동 제출 여부 (공개) */
  firstAuto: boolean;
  secondAuto: boolean;
  /** 누적 점수 */
  scoreAfter: { p1: number; p2: number };
  scoreDelta: { p1: number; p2: number };
  /** 누적 패자 금액 (라운드별 + 합) */
  loserAmountThisRound: number | null;
  /** 라운드 종료 시점의 인벤토리 총 장수 (공개) */
  inventoryCountAfter: { p1: number; p2: number };
}

/* ───────── 게임 데이터 (game:state.gameData) ───────── */

export interface BankGameData {
  phase: BankPhase;
  round: number;
  maxRound: number;
  firstSide: BankSide;
  players: { p1: BankPlayerInfo; p2: BankPlayerInfo };
  /** 현재 라운드 정산 결과 (reveal/roundEnd) */
  roundResult: BankRoundResult | null;
  /** 정산 애니메이션 스텝 (reveal 페이즈에 채워짐) */
  resolveSteps?: BankResolveStep[];
  /** 라운드 히스토리 (양측 공개. 승자 금액은 본인 시점만 노출, 그 외 null) */
  history: BankRoundResult[];
  /** 누적 패자 금액 합 (양측 공개) */
  loserAmountTotal: number;
  finalWinner: BankSide | 'draw' | null;
  winType: BankWinType;
  isFinalRound: boolean;
}

export function cloneBet(b: BankBet): BankBet {
  return { 1000: b[1000], 3000: b[3000], 5000: b[5000], 10000: b[10000] };
}

/** N장으로 만들 수 있는 최대 금액 (시작 권종 한도). */
export function bankMaxValueWithNotes(n: number): number {
  let left = Math.max(0, n);
  let v = 0;
  const take = (d: BankDenomination, have: number) => {
    const k = Math.min(have, left);
    v += k * d;
    left -= k;
  };
  take(10000, BANK_INITIAL_INVENTORY[10000]);
  take(5000, BANK_INITIAL_INVENTORY[5000]);
  take(3000, BANK_INITIAL_INVENTORY[3000]);
  take(1000, BANK_INITIAL_INVENTORY[1000]);
  return v;
}

function roundTo1000(n: number): number {
  return Math.max(0, Math.round(n / 1000) * 1000);
}

/**
 * 초반 올인 금지. 기보 R1 p90 ~2.4만. 마지막 라운드만 잔여 전부.
 * scoreDiff = 내 점수 − 상대 점수.
 */
export function bankAmountSoftCap(remain: number, roundsLeft: number, scoreDiff: number): number {
  if (remain <= 0) return 0;
  if (roundsLeft <= 1) return remain;
  const pace = remain / roundsLeft;
  let cap = Math.min(remain, Math.max(8000, Math.round(pace * 2.05)), 24000);
  if (scoreDiff <= -2 && roundsLeft <= 4) {
    cap = Math.min(remain, cap + 4000);
  }
  if (scoreDiff >= 3) {
    cap = Math.min(cap, Math.max(7000, Math.round(pace * 1.55)));
  }
  return roundTo1000(cap);
}

export function bankMaxCountForRound(invCount: number, roundsLeft: number): number {
  if (invCount <= 0) return 0;
  if (roundsLeft <= 1) return invCount;
  if (roundsLeft <= 3) return Math.min(7, invCount);
  return Math.min(6, invCount);
}

export function bankMinNote(inv: BankBet): BankBet {
  const bet = zeroBet();
  for (const d of BANK_DENOMINATIONS) {
    if (inv[d] > 0) {
      bet[d] = 1;
      return bet;
    }
  }
  return bet;
}

/** count장으로 가능한 금액 구간. */
export function bankAmountRangeForCount(count: number): { min: number; max: number } {
  if (count <= 0) return { min: 0, max: 0 };
  return { min: count * 1000, max: bankMaxValueWithNotes(count) };
}
