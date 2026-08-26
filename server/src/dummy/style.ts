/**
 * 더미 4명이 같은 첫 수가 되지 않게.
 * 판마다 다시 뽑고, dummyId 해시로 가중만 살짝 기울인다.
 * 닉별 오프닝 하드코딩은 지문이라 안 한다.
 */

export interface DummyStyle {
  /** -0.35(약패 털기) … +0.35(강패·공격) */
  aggression: number;
  /** 0.2 … 0.7 약한 패를 초반에 얼마나 섞을지 */
  dump: number;
}

export function dummyStyle(dummyId: string): DummyStyle {
  let h = 2166136261;
  for (let i = 0; i < dummyId.length; i++) {
    h ^= dummyId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 4294967296;
  const v = ((h >>> 8) >>> 0) / 4294967296;
  return {
    aggression: u * 0.7 - 0.35,
    dump: 0.2 + v * 0.5,
  };
}

export function pickWeighted<T>(items: Array<{ item: T; w: number }>): T {
  const live = items.filter((x) => x.w > 0);
  const pool = live.length > 0 ? live : items;
  const sum = pool.reduce((s, x) => s + Math.max(0, x.w), 0);
  if (sum <= 0) return pool[0]!.item;
  let r = Math.random() * sum;
  for (const x of pool) {
    r -= Math.max(0, x.w);
    if (r <= 0) return x.item;
  }
  return pool[pool.length - 1]!.item;
}
