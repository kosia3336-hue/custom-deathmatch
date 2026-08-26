import type { DummyAiTier } from '@shared/dummy.js';
import type {
  MBNWPhase,
  MBNWRoundRecord,
  MBNWTile,
  MBNWTileColor,
  MultipleBnwAction,
} from '@shared/types/multiple-bnw.js';
import { MBNW_TILE_COLOR, MBNW_TILE_SET } from '@shared/types/multiple-bnw.js';
import { runPsychologySearch } from '../psychologySearch.js';

export interface MultipleBnwDummyView {
  gameOver: boolean;
  phase: MBNWPhase;
  round: number;
  totalRounds: number;
  myId: string;
  oppId: string;
  firstPlayerId: string;
  my: {
    score: number;
    remainingTiles: MBNWTile[];
    submitted: boolean;
    isFirst: boolean;
  };
  opp: {
    score: number;
    /** 잔여 목록은 UI에 없음 — 장수만 동일 라운드 규칙으로 추론 가능 */
    submitted: boolean;
    isFirst: boolean;
  };
  colorReveal: {
    firstPlayerColor: MBNWTileColor | null;
    secondPlayerColor: MBNWTileColor | null;
  } | null;
  /** 의심 페이즈에서만 — 내 타일 숫자 */
  myTile: number | null;
  /** 색만 공개 (숫자 없음) */
  roundHistory: MBNWRoundRecord[];
  winner: string | null;
  turnStartedAt: number;
  timeLimitSeconds: number | null;
}

const ALL_TILES = [...MBNW_TILE_SET] as MBNWTile[];

function tierKnobs(tier: DummyAiTier): {
  sampleNoise: number;
  bestRate: number;
  suspectSlack: number;
} {
  if (tier === '하') return { sampleNoise: 0.32, bestRate: 0.62, suspectSlack: 0.06 };
  if (tier === '중') return { sampleNoise: 0.12, bestRate: 0.9, suspectSlack: 0.015 };
  return { sampleNoise: 0.06, bestRate: 0.97, suspectSlack: 0 };
}

function ofColor(tiles: MBNWTile[], color: MBNWTileColor): MBNWTile[] {
  return tiles.filter((t) => MBNW_TILE_COLOR[t] === color);
}

/** 마지막 1장 — 선택은 확정. 의심은 별도. */
export function isMultipleBnwLastTile(view: MultipleBnwDummyView): boolean {
  return view.my.remainingTiles.length <= 1 || view.round >= view.totalRounds;
}

/**
 * 공개 색 이력만으로 상대 잔여 타일 한 세계를 샘플.
 * COM처럼 실제 remainingTiles 를 읽지 않는다.
 */
function sampleOppRemaining(
  history: MBNWRoundRecord[],
  oppId: string,
): MBNWTile[] {
  let pool = [...ALL_TILES];
  for (const r of history) {
    const color = r.players[oppId]?.color;
    if (!color) continue;
    const cands = ofColor(pool, color);
    if (cands.length === 0) continue;
    const pick = cands[Math.floor(Math.random() * cands.length)]!;
    pool = pool.filter((t) => t !== pick);
  }
  return pool;
}

/** 상대가 이번 라운드에 낸(또는 낼) 색의 후보 타일 */
function ofColorPool(remaining: MBNWTile[], color: MBNWTileColor | null): MBNWTile[] {
  if (!color) return remaining;
  const cands = ofColor(remaining, color);
  return cands.length > 0 ? cands : remaining;
}

/** 상대가 나를 의심 성공: myTile % oppTile === 0 */
function riskRate(myTile: MBNWTile, opRemaining: MBNWTile[]): number {
  if (opRemaining.length === 0) return 0;
  return opRemaining.filter((t) => myTile % t === 0 && t !== myTile).length / opRemaining.length;
}

/** 내가 상대를 의심 성공: oppTile % myTile === 0 */
function opportunityRate(myTile: MBNWTile, opRemaining: MBNWTile[]): number {
  if (opRemaining.length === 0) return 0;
  return opRemaining.filter((t) => t % myTile === 0 && t !== myTile).length / opRemaining.length;
}

function normalWinRate(myTile: MBNWTile, opTiles: MBNWTile[]): number {
  if (opTiles.length === 0) return 0.5;
  return opTiles.filter((t) => myTile > t).length / opTiles.length;
}

function suspectSuccessProb(
  myTile: MBNWTile,
  opponentColor: MBNWTileColor,
  opponentRemaining: MBNWTile[],
): number {
  const colorTiles = ofColor(opponentRemaining, opponentColor);
  if (colorTiles.length === 0) return 0;
  return colorTiles.filter((t) => t % myTile === 0 && t !== myTile).length / colorTiles.length;
}

function scoreTileChoice(
  tile: MBNWTile,
  opPool: MBNWTile[],
  opColorFilter: MBNWTileColor | null,
  scoreGap: number,
  round: number,
): number {
  const focus = ofColorPool(opPool, opColorFilter);

  const risk = riskRate(tile, focus);
  const opportunity = opportunityRate(tile, focus);
  const normalWin = normalWinRate(tile, focus);

  let safeW = scoreGap >= 2 ? 0.5 : scoreGap <= -2 ? 0.2 : 0.35;
  let aggrW = scoreGap <= -2 ? 0.4 : scoreGap >= 2 ? 0.15 : 0.25;
  if (round >= 8) {
    // 막판: 숫자 가치 비중↑
    safeW *= 0.7;
    aggrW *= 0.7;
  }
  const normW = Math.max(0.15, 1 - safeW - aggrW);
  let s = -risk * safeW + opportunity * aggrW + normalWin * normW;
  if (round >= 8) s += (tile / 12) * 0.25;
  return s;
}

function pickFromScores(
  scored: Array<{ tile: MBNWTile; score: number }>,
  tier: DummyAiTier,
): MBNWTile {
  if (scored.length === 0) return ALL_TILES[0]!;
  scored.sort((a, b) => b.score - a.score);
  const knobs = tierKnobs(tier);
  if (scored.length === 1 || Math.random() < knobs.bestRate) return scored[0]!.tile;
  const band = scored.filter((x) => x.score >= scored[0]!.score - 0.15).slice(0, 3);
  return band[Math.floor(Math.random() * band.length)]!.tile;
}

function shouldSuspect(
  prob: number,
  round: number,
  scoreGap: number,
  tier: DummyAiTier,
): boolean {
  if (prob <= 0) return false; // 수학적으로 불가능 → 베이스

  let threshold = 0.5;
  if (round >= 8) threshold = 0.35;
  else if (round >= 6) threshold = 0.42;
  else if (round >= 4) threshold = 0.46;

  if (scoreGap <= -3) threshold -= 0.1;
  else if (scoreGap <= -1) threshold -= 0.05;
  else if (scoreGap >= 3) threshold += 0.1;
  else if (scoreGap >= 1) threshold += 0.05;

  threshold += tierKnobs(tier).suspectSlack;
  threshold = Math.max(0.3, Math.min(0.65, threshold));

  if (prob >= threshold) return true;

  // 하·중: 후반 열세 시 약한 블러프
  if (tier !== '상' && round >= 6 && scoreGap < 0 && prob > 0.15) {
    const p = tier === '하' ? 0.18 : 0.1;
    if (Math.random() < p) return true;
  }
  return false;
}

/**
 * 공개: 내 타일·점수·색 공개·과거 색. 상대 remainingTiles 배열·이번 숫자 금지.
 * budgetMs 동안 색 이력 MC로 상대 잔여 세계를 샘플하며 EV.
 */
export async function pickMultipleBnwActionAsync(
  view: MultipleBnwDummyView,
  dummyId: string,
  tier: DummyAiTier,
  budgetMs: number,
): Promise<MultipleBnwAction | null> {
  if (view.gameOver || view.winner) return null;
  if (view.myId !== dummyId) return null;

  const scoreGap = view.my.score - view.opp.score;
  const knobs = tierKnobs(tier);
  const remaining = view.my.remainingTiles;
  if (remaining.length === 0) return null;

  // ── 선플 타일 ──
  if (view.phase === 'tileSubmit') {
    if (!view.my.isFirst || view.my.submitted) return null;

    const acc = new Map<MBNWTile, number>();
    for (const t of remaining) acc.set(t, 0);

    await runPsychologySearch(budgetMs, () => {
      const opPool = sampleOppRemaining(view.roundHistory, view.oppId);
      for (const tile of remaining) {
        let s = scoreTileChoice(tile, opPool, null, scoreGap, view.round);
        s += (Math.random() * 2 - 1) * knobs.sampleNoise * 0.05;
        acc.set(tile, (acc.get(tile) ?? 0) + s);
      }
    });

    const scored = remaining.map((tile) => ({ tile, score: acc.get(tile) ?? 0 }));
    return { type: 'submitTile', tile: pickFromScores(scored, tier) };
  }

  // ── 후플 응답 (선 색 공개) ──
  if (view.phase === 'tileRespond') {
    if (view.my.isFirst || view.my.submitted) return null;
    const firstColor = view.colorReveal?.firstPlayerColor ?? null;

    const acc = new Map<MBNWTile, number>();
    for (const t of remaining) acc.set(t, 0);

    await runPsychologySearch(budgetMs, () => {
      const opPool = sampleOppRemaining(view.roundHistory, view.oppId);
      // 선은 이미 색을 냈고 그 타일은 아직 잔여에 남아 있는 세계
      for (const tile of remaining) {
        let s = scoreTileChoice(tile, opPool, firstColor, scoreGap, view.round);
        s += (Math.random() * 2 - 1) * knobs.sampleNoise * 0.05;
        acc.set(tile, (acc.get(tile) ?? 0) + s);
      }
    });

    const scored = remaining.map((tile) => ({ tile, score: acc.get(tile) ?? 0 }));
    return { type: 'respondTile', tile: pickFromScores(scored, tier) };
  }

  // ── 선플 의심 ──
  if (view.phase === 'suspectFirst') {
    if (!view.my.isFirst) return null;
    const myTile = view.myTile as MBNWTile | null;
    const oppColor = view.colorReveal?.secondPlayerColor ?? null;
    if (myTile == null || !oppColor) return null;

    let probAcc = 0;
    let n = 0;
    await runPsychologySearch(budgetMs, () => {
      const opPool = sampleOppRemaining(view.roundHistory, view.oppId);
      // 이번 라운드 후플 타일은 잔여에서 아직 안 빠짐
      const p = suspectSuccessProb(myTile, oppColor, opPool);
      probAcc += p;
      n += 1;
    });
    const prob = n > 0 ? probAcc / n : 0;
    const suspect = shouldSuspect(prob, view.round, scoreGap, tier);
    return { type: 'suspectFirst', suspect };
  }

  // ── 후플 의심 ──
  if (view.phase === 'suspectSecond') {
    if (view.my.isFirst) return null;
    const myTile = view.myTile as MBNWTile | null;
    const oppColor = view.colorReveal?.firstPlayerColor ?? null;
    if (myTile == null || !oppColor) return null;

    let probAcc = 0;
    let n = 0;
    await runPsychologySearch(budgetMs, () => {
      const opPool = sampleOppRemaining(view.roundHistory, view.oppId);
      const p = suspectSuccessProb(myTile, oppColor, opPool);
      probAcc += p;
      n += 1;
    });
    const prob = n > 0 ? probAcc / n : 0;
    const suspect = shouldSuspect(prob, view.round, scoreGap, tier);
    return { type: 'suspectSecond', suspect };
  }

  return null;
}
