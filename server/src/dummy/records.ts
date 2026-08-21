import type { GameWl } from './banpick.js';

/** 프로세스 동안만. `/dev`는 메모리. 운영 타이탄은 매치 시작 때 `rank_match_history`로 채움. */
const byDummy = new Map<string, Map<string, GameWl>>();

function row(dummyId: string): Map<string, GameWl> {
  let m = byDummy.get(dummyId);
  if (!m) {
    m = new Map();
    byDummy.set(dummyId, m);
  }
  return m;
}

export function getDummyRecords(dummyId: string): Record<string, GameWl> {
  const out: Record<string, GameWl> = {};
  for (const [gameId, rec] of row(dummyId)) {
    out[gameId] = { ...rec };
  }
  return out;
}

export function recordDummyResult(dummyId: string, gameId: string, result: 'win' | 'loss'): void {
  const m = row(dummyId);
  const rec = m.get(gameId) ?? { wins: 0, losses: 0 };
  if (result === 'win') rec.wins += 1;
  else rec.losses += 1;
  m.set(gameId, rec);
}

export function setDummyRecords(dummyId: string, rec: Record<string, GameWl>): void {
  const m = new Map<string, GameWl>();
  for (const [gameId, wl] of Object.entries(rec)) {
    m.set(gameId, { wins: wl.wins, losses: wl.losses });
  }
  byDummy.set(dummyId, m);
}

export function forgetDummyRecords(dummyId: string): void {
  byDummy.delete(dummyId);
}
