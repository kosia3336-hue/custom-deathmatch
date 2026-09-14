/* ════════════════════════════════════════════════════════════════
 * 포도설탕2 (Grape Sugar 2)
 * 8라운드 동안 카드 + 설탕을 동시 제출해 승점을 겨루는 2인 카드 베팅 심리전.
 * - 양측 동시 제출 / 제출 정보는 모두 공개 (제출 전 본인 입력만 비공개)
 * - 점수는 음수 가능, 설탕은 0 미만 불가
 * - 동점 시 무승부 종료
 * ════════════════════════════════════════════════════════════════ */

export const GS2_TOTAL_ROUNDS = 8;
export const GS2_EXTENDED_ROUNDS = 9;
export const GS2_INITIAL_SUGAR = 35;
export const GS2_HR_PENALTY = 9;
export const GS2_MAX_EXTENSIONS = 99;

/* ───────── 카드 ───────── */

export const CARD_IDS = [
  'minus3', 'plus5', 'copy', 'grapeBless', 'earthCrush',
  'dice', 'breath', 'highRisk', 'spaceCrush', 'noAction',
] as const;
export type GS2CardId = typeof CARD_IDS[number];

export const CARD_LABELS: Record<GS2CardId, string> = {
  minus3:     '-3',
  plus5:      '+5',
  copy:       '복사',
  grapeBless: '포도의가호',
  earthCrush: '지구뿌셔!',
  dice:       '주사위',
  breath:     '숨고르기',
  highRisk:   '하이리스크',
  spaceCrush: '우주뿌셔!',
  noAction:   '무행동',
};

export const CARD_DESCRIPTIONS: Record<GS2CardId, string> = {
  minus3:     '상대 이번 라운드 설탕 -3',
  plus5:      '본인 이번 라운드 설탕 +5',
  copy:       '본인 이번 라운드 설탕 ×2',
  grapeBless: '승리 시 +2점, 패배 시 -1점',
  earthCrush: '상대 이번 라운드 설탕 절반(올림)',
  dice:       '6면체 주사위: 1·2 상대 -3 / 3·4 본인 -5 / 5·6 본인 미승리 시 상대 +2점',
  breath:     '게임을 9라운드로 연장 (최초 1회만 적용)',
  highRisk:   '본인 이번 라운드 설탕 ×3, 패배 시 다음 라운드 시작에 설탕 9개 상대에게 이전 (최대 보유분)',
  spaceCrush: '상대 제출 설탕을 0으로 만들고 카드 효과 무효화 (페널티 포함)',
  noAction:   '효과 없음. 단, 상대가 우주뿌셔!를 내면 즉시 게임 승리',
};

export type GS2Priority = 1 | 2;
export type GS2CardSubtype = 'self' | 'attack' | 'penalty' | 'score' | 'meta' | 'cancel' | 'noop';

export const CARD_META: Record<GS2CardId, { priority: GS2Priority; subtype: GS2CardSubtype }> = {
  plus5:      { priority: 1, subtype: 'self'    },
  copy:       { priority: 1, subtype: 'attack'  },
  highRisk:   { priority: 1, subtype: 'attack'  },
  grapeBless: { priority: 1, subtype: 'score'   },
  dice:       { priority: 1, subtype: 'score'   },
  breath:     { priority: 1, subtype: 'meta'    },
  minus3:     { priority: 2, subtype: 'penalty' },
  earthCrush: { priority: 2, subtype: 'penalty' },
  spaceCrush: { priority: 2, subtype: 'cancel'  },
  noAction:   { priority: 2, subtype: 'noop'    },
};

/* ───────── 페이즈 / 사이드 ───────── */

export type GS2Phase =
  | 'input'        // 양측 카드+설탕 입력 중
  | 'reveal'       // 양측 제출 완료, 카드/설탕 동시 공개 + 정산 단계 애니메이션
  | 'roundEnd'     // 라운드 결과 표기, 다음 라운드 대기
  | 'extensionIntro' // 연장전 인트로
  | 'finished';    // 최종 결과

export type GS2Side = 'p1' | 'p2';
export type GS2WinType = 'score' | 'instantWin' | 'timeout' | 'abandon' | 'draw' | null;

/* ───────── 액션 (제출 정보) ───────── */

export interface GS2PlayerAction {
  card: GS2CardId;
  sugar: number;       // 0 이상 정수
}

/* ───────── 정산 단계 이벤트 ───────── */

export type GS2DiceBranch = 'opp-3' | 'self-5' | 'loserBonus';

export type GS2ResolveStep =
  | { type: 'reveal'; actions: { p1: GS2PlayerAction; p2: GS2PlayerAction } }
  | { type: 'instantWin'; winner: GS2Side; reason: 'noActionVsSpaceCrush' }
  | { type: 'cancel'; targetSide: GS2Side; bySide: GS2Side }
  | { type: 'effect'; actor: GS2Side; card: GS2CardId; targetSide: GS2Side; before: number; after: number; op: string }
  | { type: 'dice'; actor: GS2Side; roll: 1 | 2 | 3 | 4 | 5 | 6; branch: GS2DiceBranch }
  | { type: 'final'; roundSugar: { p1: number; p2: number } }
  | { type: 'winner'; winner: GS2Side | 'tie'; scoreDelta: { p1: number; p2: number } }
  | { type: 'bless'; actor: GS2Side; outcome: 'win' | 'loss' | 'tie'; scoreDelta: number }
  | { type: 'diceScore'; actor: GS2Side; loserBonusTo: GS2Side; amount: 1 | 2 }
  | { type: 'hrPenaltyScheduled'; actor: GS2Side; amount: number }
  | { type: 'breathExtended'; nowMaxRound: 9 }
  | { type: 'breathNoEffect'; actor: GS2Side; reason: 'alreadyExtended' | 'cancelled' };

/* ───────── 플레이어 공개 상태 ───────── */

export interface GS2PlayerPublic {
  id: string;
  nickname: string;
  side: GS2Side;
  score: number;
  sugarRemain: number;
  hand: GS2CardId[];
  submitted: boolean;
  hrPenaltyPending: number;
}

/* ───────── 라운드 기록 ───────── */

export interface GS2RoundRecord {
  round: number;          // 1 ~ maxRound
  extension: number;      // 0 = 본 게임, 1+ = N차 연장
  actions: { p1: GS2PlayerAction; p2: GS2PlayerAction };
  steps: GS2ResolveStep[];
  finalRoundSugar: { p1: number; p2: number };
  winner: GS2Side | 'tie';
  scoreDelta: { p1: number; p2: number };
  scoreAfter: { p1: number; p2: number };
  sugarRemainAfter: { p1: number; p2: number };
  hrPenaltyAppliedNextRound: { p1: number; p2: number };
}

/* ───────── 게임 데이터 (game:state.gameData) ───────── */

export interface GS2GameData {
  phase: GS2Phase;
  round: number;
  maxRound: 8 | 9;
  extension: number;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  /** 본인 입력 미리보기 (서버는 본인 소켓에만 채워서 전송) */
  selfPending?: { card: GS2CardId | null; sugar: number };
  /** 정산 단계 애니메이션 (reveal 페이즈에서만) */
  resolveSteps?: GS2ResolveStep[];
  /** 라운드 결과 (roundEnd 페이즈에서만) */
  roundResult?: GS2RoundRecord;
  history: GS2RoundRecord[];
  finalWinner: GS2Side | 'tie' | null;
  winType: GS2WinType;
  /** 마지막 라운드 여부 (UI 표시용) */
  isFinalRound: boolean;
}

/* ───────── 액션 페이로드 ───────── */

export type GS2Action =
  | { type: 'submit'; card: GS2CardId; sugar: number }
  | { type: 'cancelSubmit' }
  | { type: 'nextRoundReady' };

/* ───────── 헬퍼 ───────── */

export function makeInitialHand(): GS2CardId[] {
  return [...CARD_IDS];
}

export type GS2DiceFace = 1 | 2 | 3 | 4 | 5 | 6;

/** 자문 한 라운드. 공개된 카드·설탕·(유효 주사위면) 눈. pending 없음. */
export interface Gs2AdvisorRound {
  myCard: GS2CardId;
  mySugar: number;
  oppCard: GS2CardId;
  oppSugar: number;
  myDice?: GS2DiceFace;
  oppDice?: GS2DiceFace;
}

export type Gs2AdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface Gs2AdvisorSide {
  score: number;
  sugarRemain: number;
  hand: GS2CardId[];
}

export interface Gs2AdvisorSnapshot {
  round: number;
  maxRound: 8 | 9;
  breathAvailable: boolean;
  my: Gs2AdvisorSide;
  opp: Gs2AdvisorSide;
  result: Gs2AdvisorResult;
  winType: GS2WinType;
}

export type Gs2AdvisorWinner = 'me' | 'opp' | 'draw';
export type Gs2AdvisorAsk = 'submit' | 'over';

export const GS2_CHEAP_CARDS: ReadonlySet<GS2CardId> = new Set([
  'spaceCrush', 'noAction', 'breath',
]);

const GS2_SUGAR_TYPICAL: Record<GS2CardId, { mode: number; spread: number }> = {
  spaceCrush: { mode: 1, spread: 1 },
  noAction: { mode: 1, spread: 1 },
  breath: { mode: 1, spread: 1 },
  plus5: { mode: 2, spread: 2 },
  minus3: { mode: 1, spread: 2 },
  dice: { mode: 1, spread: 3 },
  copy: { mode: 6, spread: 3 },
  highRisk: { mode: 6, spread: 3 },
  grapeBless: { mode: 9, spread: 4 },
  earthCrush: { mode: 6, spread: 3 },
};

const GS2_CARD_P95: Record<GS2CardId, number> = {
  grapeBless: 13,
  highRisk: 11,
  copy: 10,
  earthCrush: 9,
  dice: 8,
  plus5: 5,
  minus3: 5,
  breath: 3,
  noAction: 3,
  spaceCrush: 2,
};

function addSugar(set: Set<number>, v: number, remain: number, cap: number): void {
  if (v < 0 || v > remain || v > cap) return;
  set.add(Math.floor(v));
}

/** 우주뿌셔를 냈는데 상대가 무행동을 낼 수 있으면 즉시패. 유일한 내 카드면 허용. */
export function gs2IsFatalChicken(hand: GS2CardId[], oppHand: GS2CardId[], card: GS2CardId): boolean {
  if (hand.length <= 1) return false;
  if (card !== 'spaceCrush') return false;
  return oppHand.includes('noAction');
}

/** 상대가 우주뿌셔만 낼 수 있으면 무행동으로 즉시 게임 승. */
export function gs2IsInstantExecute(hand: GS2CardId[], oppHand: GS2CardId[]): boolean {
  return hand.includes('noAction') && oppHand.length > 0 && oppHand.every((c) => c === 'spaceCrush');
}

/** 리드인데 숨고르기로 연장. 이미 연장이거나 유일한 카드가 아니면 버림. */
export function gs2IsWastedBreath(opts: {
  card: GS2CardId;
  handLen: number;
  breathAvailable: boolean;
  myScore: number;
  oppScore: number;
  round: number;
  maxRound: number;
}): boolean {
  if (opts.card !== 'breath') return false;
  if (opts.handLen <= 1) return false;
  if (!opts.breathAvailable) return true;
  if (opts.myScore > opts.oppScore && opts.round >= opts.maxRound - 1) return true;
  return false;
}

/**
 * 초반 올인 금지. R1–5 설탕 ≥20은 기보 0회.
 * 마지막 라운드만 잔여 전부.
 */
export function gs2SugarSoftCap(
  card: GS2CardId,
  remain: number,
  roundsLeft: number,
  lastRound: boolean,
  scoreDiff: number,
): number {
  if (remain <= 0) return 0;
  if (lastRound || roundsLeft <= 1) return remain;

  const minSpend = GS2_CHEAP_CARDS.has(card) ? 1 : 2;
  const per = roundsLeft >= 5 ? 2.5 : roundsLeft >= 3 ? 2.0 : 1.2;
  const keep = Math.min(Math.max(0, remain - minSpend), Math.ceil((roundsLeft - 1) * per));
  const fuelCap = remain - keep;
  const roundCap = roundsLeft >= 6 ? 12 : roundsLeft >= 4 ? 12 : roundsLeft >= 3 ? 14 : 18;
  let cap = Math.min(remain, GS2_CARD_P95[card], roundCap, Math.max(minSpend, fuelCap));
  if (scoreDiff <= -2 && roundsLeft <= 3) {
    cap = Math.min(remain, cap + 4);
  }
  return Math.max(0, Math.floor(cap));
}

export function gs2SugarCandidates(
  card: GS2CardId,
  remain: number,
  roundsLeft: number,
  lastRound: boolean,
  scoreDiff = 0,
): number[] {
  const cap = gs2SugarSoftCap(card, remain, roundsLeft, lastRound, scoreDiff);
  const set = new Set<number>();
  const t = GS2_SUGAR_TYPICAL[card];
  addSugar(set, 0, remain, cap);
  addSugar(set, 1, remain, cap);
  addSugar(set, t.mode, remain, cap);
  addSugar(set, t.mode - t.spread, remain, cap);
  addSugar(set, Math.min(t.mode + t.spread, cap), remain, cap);
  const pace = Math.min(cap, Math.floor(remain / Math.max(1, roundsLeft)));
  addSugar(set, pace, remain, cap);
  addSugar(set, Math.max(1, pace - 1), remain, cap);
  addSugar(set, pace + 1, remain, cap);

  if (GS2_CHEAP_CARDS.has(card)) {
    addSugar(set, Math.min(2, remain, cap), remain, cap);
  } else if (lastRound || roundsLeft <= 1) {
    addSugar(set, remain, remain, cap);
    if (remain >= 2) addSugar(set, remain - 1, remain, cap);
  } else {
    addSugar(set, cap, remain, cap);
    addSugar(set, Math.min(remain, t.mode + 2, cap), remain, cap);
  }

  if ((card === 'copy' || card === 'highRisk') && remain >= 2) {
    set.delete(0);
  }
  if (card === 'spaceCrush' && remain >= 1) {
    set.delete(0);
  }
  if ((card === 'dice' || card === 'grapeBless') && remain >= 2 && roundsLeft > 2) {
    set.delete(0);
  }

  const out = [...set].filter((s) => s <= cap).sort((a, b) => a - b);
  if (out.length > 0) return out;
  return [Math.min(remain, cap, GS2_CHEAP_CARDS.has(card) ? 1 : Math.max(1, pace))];
}

/** 우주뿌셔로 무효가 아니면 주사위가 굴려진다. 자문은 나를 p1으로 둔다. */
export function gs2DiceEffective(
  myCard: GS2CardId,
  oppCard: GS2CardId,
  who: 'me' | 'opp',
): boolean {
  if (myCard === 'spaceCrush' && oppCard === 'spaceCrush') return false;
  if (who === 'me') return myCard === 'dice' && oppCard !== 'spaceCrush';
  return oppCard === 'dice' && myCard !== 'spaceCrush';
}

export function gs2IsDiceFace(n: unknown): n is GS2DiceFace {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6;
}
