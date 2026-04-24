import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { FTAction, FTStackCount, FTTower } from '@shared/types/five-towers.js';
import { FT_HALF_MILESTONE, FT_MAX_SCORE, FT_TOWERS, FT_TOWER_MAX_HEIGHT, AI_DELAY } from './constants.js';
import type { IO } from './constants.js';
import type { InternalState, FTPlayerInternal } from './types.js';
import { handleAction, getOpponent, getPlayer } from './state.js';

function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

interface TowerEstimate {
  id: FTTower;
  /** AI 자신이 쌓은 칸 (확정) */
  myKnown: number;
  /** 마일스톤 기반 하한 */
  publicMin: number;
  /** 추정 높이 */
  estimate: number;
  /** 추정 남은 칸 수 */
  estRemain: number;
  completed: boolean;
}

function estimateTowers(s: InternalState, ai: FTPlayerInternal): TowerEstimate[] {
  return FT_TOWERS.map((id) => {
    const t = s.towers[id];
    const myKnown = ai.myStackedHeights[id] ?? 0;
    const publicMin = t.completed ? FT_TOWER_MAX_HEIGHT : (t.halfReached ? FT_HALF_MILESTONE : 0);
    // 추정: 자기 쌓음과 공개 마일스톤의 max + 약간의 노이즈
    let estimate = Math.max(myKnown, publicMin);
    if (!t.completed) {
      // 상대가 평균적으로 1.5칸씩 쌓는다 가정 → 턴 수 기반 미세 보정
      // 단순히 상대 행동 횟수에 비례한 작은 가산
      const opponentTurns = Math.max(0, Math.floor(s.turn / 2) - myKnown);
      const guess = Math.min(FT_TOWER_MAX_HEIGHT - 1, estimate + Math.floor(opponentTurns * 0.3));
      estimate = guess;
    }
    return {
      id,
      myKnown,
      publicMin,
      estimate,
      estRemain: t.completed ? 0 : Math.max(0, FT_TOWER_MAX_HEIGHT - estimate),
      completed: t.completed,
    };
  });
}

function decideStack(s: InternalState, ai: FTPlayerInternal): FTAction {
  const opp = getOpponent(s, ai.id)!;
  const ests = estimateTowers(s, ai).filter((e) => !e.completed);

  // 매치포인트(상대 2점)일 땐 상대가 가까운 탑을 막거나 빠르게 마무리
  const oppMatchPoint = opp.score === FT_MAX_SCORE - 1;
  const myMatchPoint = ai.score === FT_MAX_SCORE - 1;

  // 후보 정렬: 내가 거의 완성한 탑을 우선
  const candidates = [...ests].sort((a, b) => a.estRemain - b.estRemain);
  let target = candidates[0];

  // 내가 우세하지 않다면, 약간 노이즈 — 항상 같은 탑만 쌓지 않도록
  if (!myMatchPoint && Math.random() < 0.25) {
    target = candidates[Math.min(candidates.length - 1, rand(0, 2))];
  }

  // 칸 수 결정
  let count: FTStackCount = 2;
  if (myMatchPoint && target.estRemain <= 3) {
    count = Math.max(1, Math.min(3, target.estRemain)) as FTStackCount;
  } else if (oppMatchPoint) {
    // 상대 매치 포인트 → 보수적으로 1칸 (정보 수집)
    count = 1;
  } else {
    // 일반: 2칸 위주, 가끔 1/3
    const r = Math.random();
    count = (r < 0.55 ? 2 : (r < 0.8 ? 1 : 3)) as FTStackCount;
  }

  // 6칸 마일스톤 직전이면 칸 수 줄여서 노출 회피 (선택적)
  if (!s.towers[target.id].halfReached) {
    const remainToHalf = FT_HALF_MILESTONE - target.estimate;
    if (remainToHalf >= 1 && remainToHalf <= 3 && count > remainToHalf && Math.random() < 0.5) {
      count = remainToHalf as FTStackCount;
    }
  }

  return { type: 'stack', tower: target.id, count };
}

function maybeUseItem(s: InternalState, ai: FTPlayerInternal): FTAction | null {
  if (ai.itemUsed) return null;

  const opp = getOpponent(s, ai.id)!;
  const oppMatchPoint = opp.score === FT_MAX_SCORE - 1;
  const myMatchPoint = ai.score === FT_MAX_SCORE - 1;
  const ests = estimateTowers(s, ai).filter((e) => !e.completed);

  // 매치포인트에서 시크릿: 내가 마무리하기 가장 쉬운 탑에 사용
  if (myMatchPoint && Math.random() < 0.5) {
    const target = [...ests].sort((a, b) => a.estRemain - b.estRemain)[0];
    if (target && target.estRemain <= 3) {
      const count = Math.max(1, Math.min(3, target.estRemain)) as FTStackCount;
      return { type: 'item', item: 'secret', target: target.id, count };
    }
  }

  // 상대 매치포인트: 정보로 위험 평가
  if (oppMatchPoint && Math.random() < 0.4 && ests.length >= 2) {
    const sorted = [...ests].sort((a, b) => a.estRemain - b.estRemain);
    const a = sorted[0].id;
    const b = sorted[1].id;
    return { type: 'item', item: 'info', targets: [a, b] };
  }

  // 가끔 제로로 페이크 (탑이 5개 다 미완성일 때)
  if (s.turn >= 5 && Math.random() < 0.08 && ests.length >= 2) {
    const target = ests[rand(0, ests.length - 1)];
    return { type: 'item', item: 'zero', target: target.id };
  }

  return null;
}

export function aiAct(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'turn' || s.currentPlayerId !== AI_PLAYER_ID) return;
  const ai = getPlayer(s, AI_PLAYER_ID);
  if (!ai) return;

  const generation = s.aiGeneration;
  const delay = rand(AI_DELAY.min, AI_DELAY.max);
  setTimeout(() => {
    if (s.gameOver || s.aiGeneration !== generation) return;
    if (s.phase !== 'turn' || s.currentPlayerId !== AI_PLAYER_ID) return;

    const action = maybeUseItem(s, ai) ?? decideStack(s, ai);
    handleAction(io, makeFakeSocket(io, ai.id), s, ai.id, action);
  }, delay);
}

/** AI는 실제 socket이 없으므로, error 이벤트만 흡수하는 가짜 객체 */
function makeFakeSocket(_io: IO, _id: string): import('./constants.js').TypedSocket {
  // handleAction 은 socket.emit('error', …) 만 호출하므로 noop 으로 충분
  return {
    emit: () => true,
  } as unknown as import('./constants.js').TypedSocket;
}
