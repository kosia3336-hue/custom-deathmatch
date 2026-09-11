/**
 * multiple-bnw COM AI
 *
 * 판정 공식 (judge.ts 준수):
 *   선플 의심 성공: sp.tile % fp.tile === 0  → 상대(후플) 타일이 내(선플) 타일의 배수
 *   후플 의심 성공: fp.tile % sp.tile === 0  → 상대(선플) 타일이 내(후플) 타일의 배수
 *
 * 타일 세트 내 배수 관계 요약 (같은 숫자 = 1배수도 성공, judge.ts):
 *   3 → (3, 6, 9, 12)   4 → (4, 8, 12)   5 → (5, 10)   6 → (6, 12)
 *   7, 8, 9, 10, 12: 자기 자신만
 */

import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { MBNWTile, MBNWTileColor } from '@shared/types/multiple-bnw.js';
import { MBNW_TILE_COLOR } from '@shared/types/multiple-bnw.js';
import { AI_TILE_DELAY, AI_SUSPECT_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, MBNWPlayerInternal } from './types.js';
import {
  gameStates, broadcastState, processRound,
  startPhaseTimer, getFirstPlayer, getSecondPlayer,
} from './state.js';
import { judgeMultiple } from './judge.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randDelay(range: { min: number; max: number }): number {
  return range.min + Math.random() * (range.max - range.min);
}

function getAI(s: InternalState): MBNWPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player1 : s.player2;
}

function getUser(s: InternalState): MBNWPlayerInternal {
  return s.player1.id === AI_PLAYER_ID ? s.player2 : s.player1;
}

/* ────────── scoring primitives ────────── */

/**
 * 내가 `tile`을 냈을 때 상대가 의심 성공할 확률.
 * 조건: `myTile % opTile === 0` (내 타일이 상대 타일의 배수)
 * → 상대 잔여 타일 중 내 타일의 약수인 것 / 전체
 */
function riskRate(myTile: MBNWTile, opRemaining: MBNWTile[]): number {
  if (opRemaining.length === 0) return 0;
  const divisors = opRemaining.filter(t => myTile % t === 0);
  return divisors.length / opRemaining.length;
}

/**
 * 내가 `tile`을 냈을 때 내가 의심 성공할 수 있는 타일 수 비율.
 * 조건: `opTile % myTile === 0` (상대 타일이 내 타일의 배수)
 * → 상대 잔여 타일 중 내 타일의 배수인 것 / 전체
 */
function opportunityRate(myTile: MBNWTile, opRemaining: MBNWTile[]): number {
  if (opRemaining.length === 0) return 0;
  const multiples = opRemaining.filter(t => t % myTile === 0);
  return multiples.length / opRemaining.length;
}

/**
 * 내가 `tile`을 냈을 때 숫자 정산에서 이길 확률.
 * opColorTiles: 상대가 이번 라운드 낼 수 있는 색상 타일 (색 정보 있을 때) 또는 전체 잔여
 */
function normalWinRate(myTile: MBNWTile, opColorTiles: MBNWTile[]): number {
  if (opColorTiles.length === 0) return 0.5;
  return opColorTiles.filter(t => myTile > t).length / opColorTiles.length;
}

/**
 * 의심 성공 확률 (선언 결정 시 사용).
 * 상대가 공개한 색의 잔여 타일 중 내 타일의 배수 비율.
 */
function suspectSuccessProb(
  myTile: MBNWTile,
  opponentColor: MBNWTileColor,
  opponentRemaining: MBNWTile[],
): number {
  const colorTiles = opponentRemaining.filter(t => MBNW_TILE_COLOR[t] === opponentColor);
  if (colorTiles.length === 0) return 0;
  return colorTiles.filter(t => t % myTile === 0).length / colorTiles.length;
}

/* ────────── tile selection ────────── */

/**
 * 선플 타일 선택.
 * 각 타일을 (안전성, 기회, 숫자가치)로 점수화.
 */
function aiSelectFirstTile(s: InternalState): MBNWTile {
  const ai = getAI(s);
  const user = getUser(s);
  const remaining = ai.remainingTiles;
  const opRemaining = user.remainingTiles;

  if (remaining.length === 1) return remaining[0];

  // 마지막 2라운드: 숫자 최대값 우선
  if (s.round >= 8) return Math.max(...remaining) as MBNWTile;

  const scoreGap = ai.score - user.score;

  const scored = remaining.map((tile) => {
    const risk = riskRate(tile, opRemaining);
    const opportunity = opportunityRate(tile, opRemaining);
    const normalWin = normalWinRate(tile, opRemaining);

    // 점수 격차에 따른 전략 비중 조정
    // 이기고 있을 때 → 안전 중시, 지고 있을 때 → 기회(의심) 중시
    const safeW = scoreGap >= 2 ? 0.50 : scoreGap <= -2 ? 0.20 : 0.35;
    const aggrW = scoreGap <= -2 ? 0.40 : scoreGap >= 2 ? 0.15 : 0.25;
    const normW = 1 - safeW - aggrW;

    return {
      tile,
      score: -risk * safeW + opportunity * aggrW + normalWin * normW,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // 최상위 후보에 확률적 선택 (항상 같은 선택 방지)
  const topCount = Math.min(2, scored.length);
  if (topCount === 1 || Math.random() < 0.72) return scored[0].tile;
  return scored[1].tile;
}

/**
 * 후플 타일 선택.
 * 선플이 공개한 색 정보를 활용해 더 정밀한 분석.
 */
function aiRespondTile(s: InternalState, firstPlayerColor: MBNWTileColor): MBNWTile {
  const ai = getAI(s);
  const user = getUser(s);
  const remaining = ai.remainingTiles;
  const opRemaining = user.remainingTiles;

  if (remaining.length === 1) return remaining[0];

  const scoreGap = ai.score - user.score;

  // 상대가 공개한 색의 실제 잔여 타일 (선플의 실제 상태 참조)
  const opColorTiles = opRemaining.filter(t => MBNW_TILE_COLOR[t] === firstPlayerColor);

  const scored = remaining.map((tile) => {
    // 색 정보 기반 위험도: 상대 컬러 타일 중 내 타일의 약수
    const colorRisk = opColorTiles.length > 0
      ? opColorTiles.filter(t => tile % t === 0).length / opColorTiles.length
      : riskRate(tile, opRemaining);

    // 색 정보 기반 기회: 상대 컬러 타일 중 내 타일의 배수
    const colorOpp = opColorTiles.length > 0
      ? opColorTiles.filter(t => t % tile === 0).length / opColorTiles.length
      : opportunityRate(tile, opRemaining);

    // 숫자 정산 기대값 (색 타일 기준)
    const normalWin = normalWinRate(tile, opColorTiles.length > 0 ? opColorTiles : opRemaining);

    const safeW = scoreGap >= 2 ? 0.45 : scoreGap <= -2 ? 0.20 : 0.35;
    const aggrW = scoreGap <= -2 ? 0.35 : scoreGap >= 2 ? 0.15 : 0.25;
    const normW = 1 - safeW - aggrW;

    return {
      tile,
      score: -colorRisk * safeW + colorOpp * aggrW + normalWin * normW,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // 7라운드 이상: 최고 점수 타일만 선택
  if (s.round >= 7) return scored[0].tile;

  const topCount = Math.min(2, scored.length);
  if (topCount === 1 || Math.random() < 0.70) return scored[0].tile;
  return scored[1].tile;
}

/* ────────── suspect decision ────────── */

/**
 * 의심 선언 여부 결정.
 *
 * 기대값(EV) = P(성공) × +1 - P(실패) × (상대 보너스 비용)
 *            = 2×P - 1
 * EV > 0 이면 의심, 즉 P > 0.5 이면 의심이 이론적 최선.
 *
 * 실제 임계값은 라운드 & 점수 격차로 조정.
 */
function aiShouldSuspect(
  myTile: MBNWTile,
  opponentColor: MBNWTileColor,
  opponentRemaining: MBNWTile[],
  round: number,
  scoreGap: number,
): boolean {
  const prob = suspectSuccessProb(myTile, opponentColor, opponentRemaining);

  // 의심 성공이 애초에 불가능하면 패스
  if (prob === 0) return false;

  // 기본 임계값: EV > 0 (50%)
  let threshold = 0.50;

  // 후반 라운드일수록 더 공격적
  if (round >= 8) threshold = 0.35;
  else if (round >= 6) threshold = 0.42;
  else if (round >= 4) threshold = 0.46;

  // 점수 격차 보정
  if (scoreGap <= -3) threshold -= 0.10;      // 크게 지는 중 → 공격
  else if (scoreGap <= -1) threshold -= 0.05;
  else if (scoreGap >= 3) threshold += 0.10;  // 크게 이기는 중 → 보수
  else if (scoreGap >= 1) threshold += 0.05;

  // 임계값 구간 clamp
  threshold = Math.max(0.30, Math.min(0.65, threshold));

  if (prob >= threshold) return true;

  // 확률이 있으나 임계값 미달 시 소폭 블러핑
  // 후반 + 지고 있을 때만, 낮은 확률(12%)
  if (round >= 6 && scoreGap < 0 && prob > 0 && Math.random() < 0.12) return true;

  return false;
}

/* ────────── phase handler ────────── */

export async function handleAiTurn(io: IO, s: InternalState) {
  const ai = getAI(s);
  const fp = getFirstPlayer(s);
  const sp = getSecondPlayer(s);
  const isAiFirst = ai.id === fp.id;

  switch (s.phase) {
    case 'tileSubmit': {
      if (!isAiFirst) return;
      const gen = s.aiGeneration;
      await wait(randDelay(AI_TILE_DELAY));
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'tileSubmit') return;

      const tile = aiSelectFirstTile(s);
      ai.currentTile = tile;
      ai.submitted = true;
      s.colorReveal = { firstPlayerColor: MBNW_TILE_COLOR[tile], secondPlayerColor: null };
      s.phase = 'tileRespond';
      startPhaseTimer(io, s);
      broadcastState(io, s);
      break;
    }

    case 'tileRespond': {
      if (isAiFirst) return;
      const gen = s.aiGeneration;
      await wait(randDelay(AI_TILE_DELAY));
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'tileRespond') return;

      const tile = aiRespondTile(s, s.colorReveal!.firstPlayerColor!);
      ai.currentTile = tile;
      ai.submitted = true;
      s.colorReveal!.secondPlayerColor = MBNW_TILE_COLOR[tile];
      s.phase = 'suspectFirst';
      startPhaseTimer(io, s);
      broadcastState(io, s);
      break;
    }

    case 'suspectFirst': {
      if (!isAiFirst) return;
      const gen = s.aiGeneration;
      await wait(randDelay(AI_SUSPECT_DELAY));
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'suspectFirst') return;

      const opColor = s.colorReveal!.secondPlayerColor!;
      const scoreGap = ai.score - getUser(s).score;
      const suspect = aiShouldSuspect(
        ai.currentTile!,
        opColor,
        getUser(s).remainingTiles,
        s.round,
        scoreGap,
      );

      if (!suspect) {
        s.suspectResult = {
          firstSuspected: false,
          firstSuccess: null,
          secondSkipped: false,
          secondSuspected: null,
          secondSuccess: null,
        };
        s.phase = 'suspectSecond';
        startPhaseTimer(io, s);
        broadcastState(io, s);
      } else {
        const result = judgeMultiple(fp.currentTile!, sp.currentTile!);
        s.suspectResult = {
          firstSuspected: true,
          firstSuccess: result.success,
          secondSkipped: result.success,
          secondSuspected: null,
          secondSuccess: null,
        };
        if (result.success) {
          processRound(io, s);
        } else {
          s.phase = 'suspectSecond';
          startPhaseTimer(io, s);
          broadcastState(io, s);
        }
      }
      break;
    }

    case 'suspectSecond': {
      if (isAiFirst) return;
      const gen = s.aiGeneration;
      await wait(randDelay(AI_SUSPECT_DELAY));
      if (!gameStates.has(s.roomId) || s.aiGeneration !== gen || s.phase !== 'suspectSecond') return;

      const opColor = s.colorReveal!.firstPlayerColor!;
      const scoreGap = ai.score - getUser(s).score;
      const suspect = aiShouldSuspect(
        ai.currentTile!,
        opColor,
        getUser(s).remainingTiles,
        s.round,
        scoreGap,
      );

      s.suspectResult!.secondSuspected = suspect;
      processRound(io, s);
      break;
    }
  }
}
