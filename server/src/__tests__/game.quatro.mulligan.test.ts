import { describe, expect, it } from 'vitest';
import { applyMulligan, createState } from '../socket/games/quatro/state.js';
import { QUATRO_HAND_SIZE, QUATRO_MAX_MULLIGANS } from '@shared/types/quatro.js';

function fresh() {
  const players = [
    { id: 'a', nickname: '선' },
    { id: 'b', nickname: '후' },
  ];
  return createState('room', players as never, 'multi', Date.now(), null, () => {});
}

describe('콰트로 멀리건', () => {
  it('멀리건으로 버린 카드는 버린 사람도 상대도 다시 뽑지 않는다', () => {
    for (let trial = 0; trial < 2000; trial++) {
      const s = fresh();
      const discarded = new Set<string>();
      // 선 → 후 → 선 → 후, 모두 사용
      for (const idx of [0, 1, 0, 1]) {
        const before = s.players[idx].hand.map((c) => c.id);
        applyMulligan(s, idx, true);
        for (const c of s.players[idx].hand) expect(discarded.has(c.id)).toBe(false);
        for (const id of before) discarded.add(id);
      }
      expect(s.players[0].mulligansUsed).toBe(QUATRO_MAX_MULLIGANS);
      expect(s.players[1].mulligansUsed).toBe(QUATRO_MAX_MULLIGANS);
      // 26장이 그대로다 — 버린 카드는 가상 플레이어 분배를 위해 덱에 남는다
      const all = [...s.players[0].hand, ...s.players[1].hand, ...s.deck].map((c) => c.id);
      expect(all).toHaveLength(26);
      expect(new Set(all).size).toBe(26);
      expect(s.players[0].hand).toHaveLength(QUATRO_HAND_SIZE);
      expect(s.deck.filter((c) => discarded.has(c.id))).toHaveLength(discarded.size);
    }
  });

  it('멀리건을 거절하면 버려지는 카드가 없다', () => {
    const s = fresh();
    applyMulligan(s, 0, false);
    expect(s.mulliganDiscardIds.size).toBe(0);
    expect(s.players[0].mulliganDone).toBe(true);
  });
});
