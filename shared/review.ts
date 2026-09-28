/** 기보의 고른 수 직전까지 다시 두고, 그 수부터 솔로로 이어 두는 복기. */

export const ABSTRACT_REVIEW_GAME_IDS = [
  'game-001',
  'game-002',
  'game-023',
  'game-024',
] as const;

export const REVIEW_ACTION_LIMIT = 400;

export type ReviewRead =
  | { ok: true; actions: unknown[] | null }
  | { ok: false };

/** `gameOptions.review` 가 없으면 actions 는 null. 형식이 깨졌으면 ok: false. */
export function readReviewActions(gameOptions?: Record<string, unknown> | null): ReviewRead {
  if (!gameOptions || !Object.prototype.hasOwnProperty.call(gameOptions, 'review')) {
    return { ok: true, actions: null };
  }
  const review = gameOptions.review;
  if (!review || typeof review !== 'object' || Array.isArray(review)) return { ok: false };
  const actions = (review as { actions?: unknown }).actions;
  if (!Array.isArray(actions) || actions.length > REVIEW_ACTION_LIMIT) return { ok: false };
  return { ok: true, actions };
}

export function isAbstractReviewGame(gameId: string): boolean {
  return (ABSTRACT_REVIEW_GAME_IDS as readonly string[]).includes(gameId);
}
