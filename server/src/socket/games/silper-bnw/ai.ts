import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { SBNWTile } from '@shared/types/silper-bnw.js';
import {
  AI_DELAY,
  SBNW_MAX_SCORE,
  SBNW_TOTAL_ROUNDS,
} from './constants.js';
import type { IO } from './constants.js';
import {
  autoSubmitTiles,
  tilesToValue,
  validateTiles,
} from './judge.js';
import {
  gameStates,
  processFirstSubmitDirect,
  processSecondSubmitDirect,
} from './state.js';
import type { InternalState, SBNWPlayerInternal } from './types.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(): number {
  return AI_DELAY.min + Math.random() * (AI_DELAY.max - AI_DELAY.min);
}

function getAI(s: InternalState): SBNWPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
}

function getUser(s: InternalState): SBNWPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function totalCount(pool: Record<SBNWTile, number>): number {
  return (pool[0] ?? 0) + (pool[1] ?? 0) + (pool[2] ?? 0) + (pool[3] ?? 0) + (pool[4] ?? 0);
}

function poolCopy(pool: Record<SBNWTile, number>): Record<SBNWTile, number> {
  return { 0: pool[0] ?? 0, 1: pool[1] ?? 0, 2: pool[2] ?? 0, 3: pool[3] ?? 0, 4: pool[4] ?? 0 };
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/* ── 풀 효율 헬퍼 ─────────────────────────────────────────────── */

/** N자리 최대값 배열: leading nonzero 후 가치 desc로 채움. preserve4면 4 제외. */
function buildMaxValueTiles(
  pool: Record<SBNWTile, number>,
  digits: number,
  preserve4: boolean,
): SBNWTile[] | null {
  if (digits <= 0) return null;
  const local = poolCopy(pool);
  const result: SBNWTile[] = [];

  // 첫 자리: 가장 큰 nonzero (선두 0 금지). preserve4면 4 회피 시도.
  const firstOrder: SBNWTile[] = preserve4 ? [3, 2, 1, 4] : [4, 3, 2, 1];
  let leading: SBNWTile | null = null;
  for (const t of firstOrder) {
    if (local[t] > 0) {
      leading = t;
      break;
    }
  }
  if (leading === null) return null;
  local[leading] -= 1;
  result.push(leading);

  // 나머지 자리: 가치 desc (preserve4면 4 미루기)
  const restOrder: SBNWTile[] = preserve4 ? [3, 2, 1, 0, 4] : [4, 3, 2, 1, 0];
  for (let i = 1; i < digits; i++) {
    let picked: SBNWTile | null = null;
    for (const t of restOrder) {
      if (local[t] > 0) {
        picked = t;
        break;
      }
    }
    if (picked === null) {
      // preserve4 양보: 4 사용 허용
      if (preserve4 && local[4] > 0) {
        picked = 4;
      } else {
        return null;
      }
    }
    local[picked] -= 1;
    result.push(picked);
  }

  return result;
}

/** N자리 최소가치 (leading nonzero 후 0부터 채움). */
function buildMinValueTiles(
  pool: Record<SBNWTile, number>,
  digits: number,
  preserve4: boolean,
): SBNWTile[] | null {
  if (digits <= 0) return null;
  const local = poolCopy(pool);
  const result: SBNWTile[] = [];

  // 첫 자리: 가장 작은 nonzero
  const firstOrder: SBNWTile[] = preserve4 ? [1, 2, 3, 4] : [1, 2, 3, 4];
  let leading: SBNWTile | null = null;
  for (const t of firstOrder) {
    if (preserve4 && t === 4) continue;
    if (local[t] > 0) {
      leading = t;
      break;
    }
  }
  if (leading === null) {
    if (local[4] > 0) {
      leading = 4;
    } else {
      return null;
    }
  }
  local[leading] -= 1;
  result.push(leading);

  // 나머지: 가치 asc (0,1,2,3,4 — preserve4면 4 미루기)
  const restOrder: SBNWTile[] = preserve4 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4];
  for (let i = 1; i < digits; i++) {
    let picked: SBNWTile | null = null;
    for (const t of restOrder) {
      if (preserve4 && t === 4) continue;
      if (local[t] > 0) {
        picked = t;
        break;
      }
    }
    if (picked === null) {
      if (local[4] > 0) {
        picked = 4;
      } else {
        return null;
      }
    }
    local[picked] -= 1;
    result.push(picked);
  }

  return result;
}

/** 같은 자릿수에서 target 초과하는 최소가치 배열 (가치 desc로 채우다가 초과 시점에 멈춤) */
function buildMinWinningSameDigits(
  pool: Record<SBNWTile, number>,
  digits: number,
  target: bigint,
  preserve4: boolean,
): SBNWTile[] | null {
  if (digits <= 0) return null;
  // 우선 최대값 배열로 가능한지 확인
  const maxArr = buildMaxValueTiles(pool, digits, preserve4);
  if (!maxArr) return null;
  if (tilesToValue(maxArr) <= target) {
    // preserve4 끄고 다시 시도
    if (preserve4) {
      const maxArr2 = buildMaxValueTiles(pool, digits, false);
      if (!maxArr2 || tilesToValue(maxArr2) <= target) return null;
      return refineMinWinning(pool, digits, target, maxArr2, false);
    }
    return null;
  }
  return refineMinWinning(pool, digits, target, maxArr, preserve4);
}

/** maxArr는 win이 보장된 상태. 후미부터 가치를 낮춰가며 여전히 win인 가장 작은 배열 탐색 */
function refineMinWinning(
  pool: Record<SBNWTile, number>,
  digits: number,
  target: bigint,
  maxArr: SBNWTile[],
  preserve4: boolean,
): SBNWTile[] {
  // 욕심: 후미부터 한 칸씩 더 작은 nonzero/0으로 교체 시도
  const result: SBNWTile[] = [...maxArr];
  // 풀 잔량 추적
  const used = poolCopy(pool);
  for (const t of result) used[t] -= 1;
  // 풀 가용 수: pool[t] - used 합으로 환원하기 어려우므로 간단히: 후보 교체 시 used 갱신
  for (let i = digits - 1; i >= 1; i--) {
    const cur = result[i];
    // 더 작은 타일로 교체할 후보 탐색 (0 → cur-1 순)
    for (let cand = 0 as SBNWTile; cand < cur; cand = (cand + 1) as SBNWTile) {
      if (preserve4 && cand === 4) continue;
      // 사용 가능: pool[cand] - used[cand] >= 1 (cur를 반환하므로 used[cur]는 1 감소 후 used[cand]는 1 증가)
      const availCand = (pool[cand] ?? 0) - used[cand];
      if (availCand < 1) continue;
      // 임시 교체
      const trial = [...result];
      trial[i] = cand;
      if (tilesToValue(trial) > target) {
        // 채택
        used[cur] -= 1;
        used[cand] += 1;
        result[i] = cand;
        break;
      }
    }
  }
  // i=0 (선두) 도 가능하면 더 작은 nonzero로 교체
  for (let cand = 1 as SBNWTile; cand < result[0]; cand = (cand + 1) as SBNWTile) {
    if (preserve4 && cand === 4) continue;
    const availCand = (pool[cand] ?? 0) - used[cand];
    if (availCand < 1) continue;
    const trial = [...result];
    trial[0] = cand;
    if (tilesToValue(trial) > target) {
      const old = result[0];
      used[old] -= 1;
      used[cand] += 1;
      result[0] = cand;
      break;
    }
  }
  return result;
}

/** 자릿수 동일 / 자릿수 +1 / +2 순으로 최소승리 배열 탐색 */
function findMinimalWinningTiles(
  pool: Record<SBNWTile, number>,
  firstDigits: number,
  firstValue: bigint,
  preserve4: boolean,
): SBNWTile[] | null {
  const total = totalCount(pool);
  // 같은 자릿수 시도
  if (totalCount(pool) >= firstDigits) {
    const same = buildMinWinningSameDigits(pool, firstDigits, firstValue, preserve4);
    if (same) return same;
  }
  // 자릿수 +k (자릿수 우위 = 무조건 승)
  for (let extra = 1; extra <= 3; extra++) {
    const target = firstDigits + extra;
    if (total < target) break;
    // 자릿수 우위는 leading nonzero만 보장하면 자동승 — 최소가치로
    const arr = buildMinValueTiles(pool, target, preserve4);
    if (arr) return arr;
    const arr2 = buildMinValueTiles(pool, target, false);
    if (arr2) return arr2;
  }
  return null;
}

/** 같은 자릿수에서 firstValue와 정확히 일치 (동점 시도) */
function findTieTiles(
  pool: Record<SBNWTile, number>,
  firstDigits: number,
  firstValue: bigint,
): SBNWTile[] | null {
  if (totalCount(pool) < firstDigits) return null;
  // 그리디로 자릿수씩 채우면서 firstValue를 그대로 만들어보기
  // 단순 접근: firstValue를 자릿수 배열로 환원
  const digits: number[] = [];
  let v = firstValue;
  for (let i = 0; i < firstDigits; i++) {
    digits.unshift(Number(v % 10n));
    v = v / 10n;
  }
  if (v !== 0n) return null;
  const need: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const d of digits) {
    if (d < 0 || d > 4) return null;
    need[d] += 1;
  }
  for (const k of [0, 1, 2, 3, 4]) {
    if ((pool[k as SBNWTile] ?? 0) < need[k]) return null;
  }
  return digits as SBNWTile[];
}

/** 풀에서 만들 수 있는 최대값 배열 (전체 풀 활용) */
function maxPossibleValueTiles(pool: Record<SBNWTile, number>): SBNWTile[] {
  const total = totalCount(pool);
  if (total === 0) return [];
  const arr = buildMaxValueTiles(pool, total, false);
  if (arr) return arr;
  // 폴백
  return autoSubmitTiles(pool);
}

/* ── 액션 로그 분석 ─────────────────────────────────────────── */

function userAvgSecondDigits(s: InternalState, userId: string): number {
  const ds: number[] = [];
  for (const log of s.actionLog) {
    if (log.firstPlayerId === userId) continue;
    const pd = log.players[userId];
    if (pd) ds.push(pd.digits);
  }
  return mean(ds) ?? 2;
}

function userAvgFirstDigits(s: InternalState, userId: string): number {
  const ds: number[] = [];
  for (const log of s.actionLog) {
    if (log.firstPlayerId !== userId) continue;
    const pd = log.players[userId];
    if (pd) ds.push(pd.digits);
  }
  return mean(ds) ?? 2;
}

/* ── 후플 전략 ─────────────────────────────────────────────── */

function decideSecondTiles(s: InternalState, ai: SBNWPlayerInternal): SBNWTile[] {
  const total = totalCount(ai.tiles);
  if (total === 0) return [];

  const firstTiles = s.firstTiles!;
  const firstDigits = firstTiles.length;
  const firstValue = tilesToValue(firstTiles);

  const user = getUser(s);
  const aiNeeded = SBNW_MAX_SCORE - ai.score;
  const userNeeded = SBNW_MAX_SCORE - user.score;
  const roundsLeft = SBNW_TOTAL_ROUNDS - s.round + 1;
  const isGamePoint = userNeeded === 1;
  const isMatchPoint = aiNeeded === 1;
  const isEndgame = roundsLeft <= 3;

  const preserve4 = s.rematchIndex === 0 && ai.score >= user.score && !isEndgame;

  const winning = findMinimalWinningTiles(ai.tiles, firstDigits, firstValue, preserve4);

  if (isGamePoint) {
    if (winning) return winning;
    // 게임포인트인데 못 이김 → 풀 최대로 시도
    const winning2 = findMinimalWinningTiles(ai.tiles, firstDigits, firstValue, false);
    if (winning2) return winning2;
    return maxPossibleValueTiles(ai.tiles);
  }

  if (isMatchPoint) {
    if (winning) return winning;
    return autoSubmitTiles(ai.tiles);
  }

  if (winning) return winning;

  // 이김 불가
  if (aiNeeded < userNeeded) {
    // 리드 중 → 최저가 1개로 절약
    return autoSubmitTiles(ai.tiles);
  }

  // 동점 또는 열세 → 동점 가능하면 시도
  const tie = findTieTiles(ai.tiles, firstDigits, firstValue);
  if (tie && aiNeeded >= userNeeded) {
    // 동점도 양측 타일 소모이므로 항상 좋진 않음. 열세면 동점이라도 다음 기회 늘림
    return tie;
  }
  return autoSubmitTiles(ai.tiles);
}

/* ── 선플 전략 ─────────────────────────────────────────────── */

function decideFirstTiles(s: InternalState, ai: SBNWPlayerInternal): SBNWTile[] {
  const total = totalCount(ai.tiles);
  if (total === 0) return [];

  const user = getUser(s);
  const aiNeeded = SBNW_MAX_SCORE - ai.score;
  const userNeeded = SBNW_MAX_SCORE - user.score;
  const roundsLeft = SBNW_TOTAL_ROUNDS - s.round + 1;
  const isGamePoint = userNeeded === 1;
  const isMatchPoint = aiNeeded === 1;
  const isEndgame = roundsLeft <= 3;

  const expectedDigits = userAvgSecondDigits(s, user.id);
  const preserve4 = s.rematchIndex === 0 && ai.score >= user.score && !isEndgame;

  // 잔여 풀 적음: 가능한 최대 자릿수·최대 값
  if (total <= 6) {
    return maxPossibleValueTiles(ai.tiles);
  }

  // 직전 라운드 결과 확인
  const last = s.actionLog[s.actionLog.length - 1];
  const lostLast = last && last.winnerId !== null && last.winnerId !== ai.id;

  // 게임포인트: 자릿수 +1 우위 공세, 4 포함 최대
  if (isGamePoint) {
    const target = clamp(Math.ceil(expectedDigits) + 1, 1, total);
    const arr = buildMaxValueTiles(ai.tiles, target, false);
    if (arr) return arr;
    return maxPossibleValueTiles(ai.tiles);
  }

  // 매치포인트: expectedDigits 자리 평균 가치
  if (isMatchPoint) {
    const target = clamp(Math.round(expectedDigits), 1, total);
    const arr = buildMaxValueTiles(ai.tiles, target, false);
    if (arr) return arr;
    return autoSubmitTiles(ai.tiles);
  }

  // 승점 우세 (블러핑): 1~2자리 저값
  if (aiNeeded < userNeeded) {
    const bluffDigits = randInt(1, 2);
    const arr = buildMinValueTiles(ai.tiles, bluffDigits, preserve4);
    if (arr) return arr;
    return autoSubmitTiles(ai.tiles);
  }

  // 승점 열세: expectedDigits 또는 +1자리로 공세
  if (aiNeeded > userNeeded) {
    const bonus = lostLast ? 1 : 0;
    const target = clamp(Math.ceil(expectedDigits) + bonus, 1, total);
    const arr = buildMaxValueTiles(ai.tiles, target, preserve4 && bonus === 0);
    if (arr) return arr;
    return autoSubmitTiles(ai.tiles);
  }

  // 중립: 2~3자리 중간 값
  const target = randInt(2, 3);
  // 중간값 = 최소가치 배열 + 0~1 보강. 단순화: 최소가치 배열 사용
  const arr = buildMinValueTiles(ai.tiles, Math.min(target, total), preserve4);
  if (arr) return arr;
  return autoSubmitTiles(ai.tiles);
}

/* ── 폴백 검증 ────────────────────────────────────────────── */

function safeResult(ai: SBNWPlayerInternal, candidate: SBNWTile[]): SBNWTile[] {
  if (candidate.length === 0) return autoSubmitTiles(ai.tiles);
  const v = validateTiles(candidate, ai.tiles);
  if (v.ok) return candidate;
  return autoSubmitTiles(ai.tiles);
}

/* ── 외부 진입점 ────────────────────────────────────────────── */

export async function aiSubmitFirst(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'firstSubmit') return;
  const ai = getAI(s);
  if (ai.id !== s.firstPlayerId) return;

  const gen = s.aiGeneration;
  await wait(randDelay());
  if (!gameStates.has(s.roomId) || s.gameOver) return;
  if (s.aiGeneration !== gen || s.phase !== 'firstSubmit') return;

  const tiles = safeResult(ai, decideFirstTiles(s, ai));
  if (tiles.length === 0) return; // autoLoss 조건은 advanceRound가 처리
  processFirstSubmitDirect(io, s, tiles);
}

export async function aiSubmitSecond(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'secondSubmit') return;
  const ai = getAI(s);
  if (ai.id === s.firstPlayerId) return;

  const gen = s.aiGeneration;
  await wait(randDelay());
  if (!gameStates.has(s.roomId) || s.gameOver) return;
  if (s.aiGeneration !== gen || s.phase !== 'secondSubmit') return;

  const tiles = safeResult(ai, decideSecondTiles(s, ai));
  if (tiles.length === 0) return;
  processSecondSubmitDirect(io, s, tiles);
}
