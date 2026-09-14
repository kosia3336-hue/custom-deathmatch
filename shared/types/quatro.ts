/**
 * 콰트로 (Quatro) — 심리 카드 게임 공통 타입.
 *
 * 카드: 4문양(스페이드=파랑 > 다이아=노랑 > 하트=빨강 > 클로버=초록) × 1~6 (24장)
 *       + 검정 0 카드 2장 = 총 26장.
 * 콰트로 = 4장의 숫자와 문양이 모두 다른 조합 (검정0은 만능 문양·숫자로 인정,
 *          단 검정0 2장을 모두 보유하면 콰트로 실패).
 */

export type QuatroSuit = 'spade' | 'diamond' | 'heart' | 'club' | 'black';

export interface QuatroCard {
  /** 덱 내 고유 id (예: 'spade-5', 'black-0-a') */
  id: string;
  suit: QuatroSuit;
  num: number; // black = 0, 그 외 1~6
}

/** 문양 우선순위 (높을수록 우선) — 스페이드 > 다이아 > 하트 > 클로버 */
export const QUATRO_SUIT_PRIORITY: Record<QuatroSuit, number> = {
  spade: 4,
  diamond: 3,
  heart: 2,
  club: 1,
  black: 0,
};

export const QUATRO_MAX_MULLIGANS = 2;
export const QUATRO_VP_COUNT = 6;
export const QUATRO_HAND_SIZE = 4;
export const QUATRO_TURN_SECONDS = 60;

export type QuatroPhase =
  | 'mulligan'   // 멀리건 결정 (선→후→선→후)
  | 'open'       // 라운드 시작 — 각자 오픈할 카드 1장 선택 (동시)
  | 'exchange'   // 가상 플레이어와 교환 (A-B-B-A-A-B 순)
  | 'reveal'     // 최종 공개 + 결과
  | 'finished';

export type QuatroAction =
  | { type: 'mulligan'; use: boolean }
  | { type: 'open'; cardId: string }
  | { type: 'exchange'; vpIndex: number; giveCardId: string }
  | { type: 'stop' };

/** 내 시점 카드 (상대 비공개 카드는 null) */
export interface QuatroVisibleCard {
  card: QuatroCard | null; // null = 뒷면
  open: boolean;
}

export interface QuatroVpView {
  index: number;
  /** 플레이어가 넘겨서 공개된 카드들 */
  receivedOpen: QuatroCard[];
  /** 남은 비공개 카드 수 */
  hiddenCount: number;
  /** 나와 교환했는지 */
  usedByMe: boolean;
  /** 상대와 교환했는지 (교환 사실만 공개) */
  usedByOpp: boolean;
  /** 관전자 전용 — 가상 플레이어의 전체 패 (플레이어에게는 없음) */
  cards?: QuatroCard[];
}

/** 아카이브용 진행 로그 */
export type QuatroLogEntry =
  | { round: number; type: 'mulligan'; actorId: string; used: boolean }
  | { round: number; type: 'open'; actorId: string; card: QuatroCard }
  | { round: number; type: 'exchange'; actorId: string; vpIndex: number; gave: QuatroCard; received: QuatroCard }
  | { round: number; type: 'stop'; actorId: string };

export interface QuatroPlayerView {
  id: string;
  nickname: string;
  mulligansUsed: number;
  /** 이번 교환 페이즈에서 스탑 선언 여부 */
  stopped: boolean;
  /** 교환 완료한 가상 플레이어 수 */
  vpUsedCount: number;
  hand: QuatroVisibleCard[]; // 항상 4장 (본인=전부 공개, 상대=오픈만)
}

export interface QuatroResultSummary {
  winnerId: string | null; // null = 무승부
  reason: string;
  hands: Record<string, QuatroCard[]>;
  quatro: Record<string, boolean>;
  sums: Record<string, number>;
}

export interface QuatroGameData {
  phase: QuatroPhase;
  round: number; // 1~4 (오픈 라운드)
  firstId: string; // 이번 라운드 선
  currentTurnId: string | null; // 지금 행동할 사람 (open 단계는 null=동시)
  me: QuatroPlayerView | null; // 관전자는 null
  opp: QuatroPlayerView | null;
  players: Record<string, { nickname: string }>;
  vps: QuatroVpView[];
  /** open 단계: 내가 선택 완료했는지 */
  iOpened: boolean;
  oppOpened: boolean;
  /** 마지막 교환 페이즈(3라운드)에서 남은 필수 교환 수 */
  mustExchangeRemaining: number;
  result: QuatroResultSummary | null;
  /** 턴 제한(초). 0 = 무제한 */
  turnSeconds: number;
}

export const QUATRO_SUITS: QuatroSuit[] = ['spade', 'diamond', 'heart', 'club'];

export const QUATRO_SUIT_MARK: Record<QuatroSuit, string> = {
  spade: '♠',
  diamond: '♦',
  heart: '♥',
  club: '♣',
  black: '●',
};

export function cloneQuatroCard(c: QuatroCard): QuatroCard {
  return { id: c.id, suit: c.suit, num: c.num };
}

export function quatroFullDeck(): QuatroCard[] {
  const deck: QuatroCard[] = [];
  for (const suit of QUATRO_SUITS) {
    for (let n = 1; n <= 6; n++) deck.push({ id: `${suit}-${n}`, suit, num: n });
  }
  deck.push({ id: 'black-0-a', suit: 'black', num: 0 });
  deck.push({ id: 'black-0-b', suit: 'black', num: 0 });
  return deck;
}

export function quatroCardById(id: string): QuatroCard | null {
  return quatroFullDeck().find((c) => c.id === id) ?? null;
}

export function quatroSuitPri(c: QuatroCard): number {
  return QUATRO_SUIT_PRIORITY[c.suit];
}

export function quatroIsQuatro(hand: QuatroCard[]): boolean {
  if (hand.filter((c) => c.suit === 'black').length >= 2) return false;
  const normal = hand.filter((c) => c.suit !== 'black');
  const suits = new Set(normal.map((c) => c.suit));
  const nums = new Set(normal.map((c) => c.num));
  return suits.size === normal.length && nums.size === normal.length;
}

export function quatroHandSum(hand: QuatroCard[]): number {
  return hand.reduce((a, c) => a + c.num, 0);
}

export function quatroDistinctSize(hand: QuatroCard[]): number {
  const blacks = hand.filter((c) => c.suit === 'black').length;
  if (blacks >= 2) return 0;
  const normal = hand.filter((c) => c.suit !== 'black');
  return Math.min(new Set(normal.map((c) => c.suit)).size, new Set(normal.map((c) => c.num)).size) + blacks;
}

export function quatroCompareHands(a: QuatroCard[], b: QuatroCard[]): number {
  const key = (h: QuatroCard[]) =>
    [...h].sort((x, y) => (y.num - x.num) || (quatroSuitPri(y) - quatroSuitPri(x)));
  const ka = key(a);
  const kb = key(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const ca = ka[i];
    const cb = kb[i];
    if (!ca || !cb) return ca ? 1 : cb ? -1 : 0;
    if (ca.num !== cb.num) return ca.num > cb.num ? 1 : -1;
    if (quatroSuitPri(ca) !== quatroSuitPri(cb)) return quatroSuitPri(ca) > quatroSuitPri(cb) ? 1 : -1;
  }
  return 0;
}

export function quatroJudgeHands(
  my: QuatroCard[],
  opp: QuatroCard[],
): { winner: 'me' | 'opp' | 'draw'; reason: string; myQuatro: boolean; oppQuatro: boolean; mySum: number; oppSum: number } {
  const myQuatro = quatroIsQuatro(my);
  const oppQuatro = quatroIsQuatro(opp);
  const mySum = quatroHandSum(my);
  const oppSum = quatroHandSum(opp);
  if (myQuatro !== oppQuatro) {
    return {
      winner: myQuatro ? 'me' : 'opp',
      reason: '콰트로 완성',
      myQuatro,
      oppQuatro,
      mySum,
      oppSum,
    };
  }
  const label = myQuatro ? '콰트로 완성 — ' : '';
  if (mySum !== oppSum) {
    return {
      winner: mySum > oppSum ? 'me' : 'opp',
      reason: `${label}합계 ${Math.max(mySum, oppSum)} vs ${Math.min(mySum, oppSum)}`,
      myQuatro,
      oppQuatro,
      mySum,
      oppSum,
    };
  }
  const cmp = quatroCompareHands(my, opp);
  if (cmp === 0) {
    return { winner: 'draw', reason: '완전 동점', myQuatro, oppQuatro, mySum, oppSum };
  }
  return {
    winner: cmp > 0 ? 'me' : 'opp',
    reason: `${label}합계 동점 — 높은 카드 우세`,
    myQuatro,
    oppQuatro,
    mySum,
    oppSum,
  };
}

/** 규칙 복사. 실상태 VP 패는 호출 측이 넣지 않는다. */
export function quatroVpPickFrom(vpCards: QuatroCard[], openCards: QuatroCard[]): QuatroCard {
  const black = vpCards.find((c) => c.suit === 'black');
  if (black) return black;
  const openSuits = new Set(openCards.filter((c) => c.suit !== 'black').map((c) => c.suit));
  const openNums = new Set(openCards.filter((c) => c.suit !== 'black').map((c) => c.num));
  const fit = vpCards.filter((c) => c.suit === 'black' || (!openSuits.has(c.suit) && !openNums.has(c.num)));
  const pool = fit.length > 0 ? fit : vpCards;
  return [...pool].sort((a, b) => (b.num - a.num) || (quatroSuitPri(b) - quatroSuitPri(a)))[0]!;
}

/** 기보: R1은 6을 잠근다. 오픈은 교환 불가이므로 키퍼. COM 최악 카드 오픈과 반대. */
export function quatroOpenScore(card: QuatroCard, alreadyOpen: QuatroCard[]): number {
  const clash = alreadyOpen.some((o) =>
    o.suit !== 'black' && card.suit !== 'black' && (o.suit === card.suit || o.num === card.num),
  );
  let s = card.num * 12;
  if (card.suit === 'black') s = 28;
  if (clash) s -= 90;
  s += quatroSuitPri(card);
  return s;
}

export function quatroPickOpenCard(closed: QuatroCard[], alreadyOpen: QuatroCard[]): QuatroCard | null {
  if (closed.length === 0) return null;
  let best = closed[0]!;
  let bestS = -1e9;
  for (const c of closed) {
    const s = quatroOpenScore(c, alreadyOpen);
    if (s > bestS) {
      bestS = s;
      best = c;
    }
  }
  return best;
}

export function quatroShouldMulligan(hand: QuatroCard[], used: number): boolean {
  if (used >= QUATRO_MAX_MULLIGANS) return false;
  if (quatroIsQuatro(hand)) return false;
  const blacks = hand.filter((c) => c.suit === 'black').length;
  if (blacks >= 2) return true;
  if (quatroDistinctSize(hand) < 3) return true;
  if (quatroDistinctSize(hand) === 3 && quatroHandSum(hand) <= 9) return true;
  return false;
}

/** 기보: 교환의 91%가 마지막(R3). R1·R2는 거의 스탑. */
export function quatroShouldStopEarly(round: number, hand: QuatroCard[]): boolean {
  if (round >= 3) return false;
  if (quatroIsQuatro(hand)) return true;
  if (hand.filter((c) => c.suit === 'black').length >= 2) return false;
  if (quatroDistinctSize(hand) < 3) return false;
  return true;
}

export function quatroCardLabel(c: QuatroCard): string {
  if (c.suit === 'black') return c.id.endsWith('-b') ? '검정0B' : '검정0A';
  return `${QUATRO_SUIT_MARK[c.suit]}${c.num}`;
}
