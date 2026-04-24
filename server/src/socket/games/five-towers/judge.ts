import type { FTAction, FTErrorReason, FTStackCount } from '@shared/types/five-towers.js';
import { FT_MAX_STACK, FT_MIN_STACK, FT_TOWER_MAX_HEIGHT, FT_TOWERS } from './constants.js';
import type { InternalState, FTPlayerInternal } from './types.js';

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: FTErrorReason };

function isValidTower(t: unknown): boolean {
  return typeof t === 'string' && (FT_TOWERS as readonly string[]).includes(t);
}

function isValidCount(n: unknown): n is FTStackCount {
  return typeof n === 'number' && Number.isInteger(n) && n >= FT_MIN_STACK && n <= FT_MAX_STACK;
}

export function validateAction(
  s: InternalState,
  actor: FTPlayerInternal,
  action: FTAction,
): ValidationResult {
  if (s.phase !== 'turn') return { ok: false, reason: 'phaseMismatch' };
  if (s.currentPlayerId !== actor.id) return { ok: false, reason: 'notYourTurn' };

  if (action.type === 'stack') {
    if (!isValidTower(action.tower)) return { ok: false, reason: 'invalidTower' };
    if (!isValidCount(action.count)) return { ok: false, reason: 'invalidCount' };
    const tower = s.towers[action.tower];
    if (tower.completed) return { ok: false, reason: 'towerCompleted' };
    return { ok: true };
  }

  if (action.type === 'item') {
    if (actor.itemUsed) return { ok: false, reason: 'itemAlreadyUsed' };

    if (action.item === 'info') {
      const [a, b] = action.targets ?? [];
      if (!isValidTower(a) || !isValidTower(b)) return { ok: false, reason: 'invalidTower' };
      if (a === b) return { ok: false, reason: 'sameTargets' };
      if (s.towers[a].completed || s.towers[b].completed) {
        return { ok: false, reason: 'towerCompleted' };
      }
      return { ok: true };
    }

    if (action.item === 'zero') {
      if (!isValidTower(action.target)) return { ok: false, reason: 'invalidTower' };
      if (s.towers[action.target].completed) return { ok: false, reason: 'towerCompleted' };
      return { ok: true };
    }

    if (action.item === 'secret') {
      if (!isValidTower(action.target)) return { ok: false, reason: 'invalidTower' };
      if (!isValidCount(action.count)) return { ok: false, reason: 'invalidCount' };
      if (s.towers[action.target].completed) return { ok: false, reason: 'towerCompleted' };
      return { ok: true };
    }
  }

  return { ok: false, reason: 'unknownAction' };
}

export function errorMessage(reason: FTErrorReason): string {
  switch (reason) {
    case 'phaseMismatch': return '지금은 행동할 수 없는 단계입니다.';
    case 'notYourTurn': return '내 차례가 아닙니다.';
    case 'invalidTower': return '유효하지 않은 탑입니다.';
    case 'invalidCount': return '쌓는 칸 수는 1~3 사이여야 합니다.';
    case 'towerCompleted': return '이미 완성된 탑은 선택할 수 없습니다.';
    case 'overflow': return '탑의 최대 높이를 넘을 수 없습니다.';
    case 'itemAlreadyUsed': return '아이템은 게임당 1회만 사용할 수 있습니다.';
    case 'sameTargets': return '서로 다른 두 탑을 선택해야 합니다.';
    case 'unknownAction': return '알 수 없는 행동입니다.';
  }
}

/** 자동 액션: 가장 안전한 1칸 쌓기 (남아있는 탑 중 가장 낮을 것 같은 탑) */
export function pickAutoStackTower(s: InternalState): FTAction {
  const candidates = FT_TOWERS.filter((t) => !s.towers[t].completed);
  const target = candidates[Math.floor(Math.random() * candidates.length)] ?? candidates[0];
  return { type: 'stack', tower: target, count: 1 };
}

export { FT_TOWER_MAX_HEIGHT };
