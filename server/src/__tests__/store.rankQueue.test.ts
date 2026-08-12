import { describe, expect, it, beforeEach } from 'vitest';
import { rankQueueStore, type RankQueueEntry } from '../store/rankQueue.js';

function entry(name: string, rp: number, joinedAt: number): RankQueueEntry {
  return {
    socketId: `sock-${name}`,
    memberId: `member-${name}`,
    nickname: name,
    displayedTitle: null,
    tier: 'gold',
    rp,
    placementDone: true,
    winStreak: 0,
    lossStreak: 0,
    joinedAt,
    seasonId: 1,
  };
}

/** 각 테스트가 서로 영향을 주지 않도록 큐를 비운다 */
function drain() {
  for (const n of ['a', 'b', 'c']) rankQueueStore.removeByMemberId(`member-${n}`);
}

describe('rankQueueStore', () => {
  beforeEach(drain);

  it('상대가 없으면 매칭되지 않는다', () => {
    expect(rankQueueStore.enqueue(entry('a', 50, 1)).matched).toBe(false);
  });

  it('두 명이 모이면 매칭되고 둘 다 큐에서 빠진다', () => {
    rankQueueStore.enqueue(entry('a', 50, 1));
    const res = rankQueueStore.enqueue(entry('b', 52, 2));

    expect(res.matched).toBe(true);
    // 큐가 비었으므로 다시 아무도 매칭되지 않는다
    expect(rankQueueStore.attemptAllMatches()).toHaveLength(0);
    expect(rankQueueStore.waitSeconds('member-a')).toBe(0);
    expect(rankQueueStore.waitSeconds('member-b')).toBe(0);
  });

  /**
   * 중복 매칭 사고의 재현.
   *
   * a 가 b 와 매칭돼 큐에서 빠진 직후, 같은 사람의 join 이 한 번 더 도착하면
   * (버튼 연타·connect 재참가 겹침) a 가 큐에 다시 들어가고 c 와 또 매칭된다.
   * → a 가 랭크 방 두 개에 동시에 들어간다.
   *
   * 큐 자체는 "다시 넣으면 다시 매칭" 이 맞는 동작이므로, 이 재진입을 막는 책임은
   * 호출부(socket/rankQueue.ts 의 joinInFlight + isMemberInAnyRoom 가드)에 있다.
   * 이 테스트는 가드가 없을 때 실제로 이중 매칭이 나는지를 고정해 둔다.
   */
  it('큐만으로는 이중 매칭을 막지 못한다 — 호출부 가드가 필요하다', () => {
    rankQueueStore.enqueue(entry('b', 50, 1));
    const first = rankQueueStore.enqueue(entry('a', 50, 2));
    expect(first.matched).toBe(true); // a-b 성사

    rankQueueStore.enqueue(entry('c', 50, 3));
    const second = rankQueueStore.enqueue(entry('a', 50, 4)); // a 의 중복 join

    expect(second.matched).toBe(true); // a-c 도 성사 → a 가 두 방에
  });

  it('나간 사람은 매칭 대상에서 빠진다', () => {
    rankQueueStore.enqueue(entry('a', 50, 1));
    rankQueueStore.removeBySocket('sock-a');
    expect(rankQueueStore.enqueue(entry('b', 50, 2)).matched).toBe(false);
  });
});
