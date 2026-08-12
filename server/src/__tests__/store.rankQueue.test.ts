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
  for (const n of ['a', 'b', 'c']) {
    rankQueueStore.removeByMemberId(`member-${n}`);
    rankQueueStore.releaseMatch(`member-${n}`);
  }
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
   * 중복 매칭 사고의 재현 — 이제는 큐가 막는다.
   *
   * a 가 b 와 매칭돼 큐에서 빠진 직후, 같은 사람의 join 이 한 번 더 도착하는 상황
   * (버튼 연타·재연결 재참가 겹침). 예전에는 a 가 큐에 다시 들어가 c 와 또
   * 매칭돼 랭크 방 두 개에 동시 배정됐다.
   */
  it('매칭 확정된 사람은 방이 만들어지기 전까지 큐에 다시 못 들어간다', () => {
    rankQueueStore.enqueue(entry('b', 50, 1));
    expect(rankQueueStore.enqueue(entry('a', 50, 2)).matched).toBe(true); // a-b 성사
    expect(rankQueueStore.isPendingMatch('member-a')).toBe(true);

    rankQueueStore.enqueue(entry('c', 50, 3));
    const dup = rankQueueStore.enqueue(entry('a', 50, 4)); // a 의 중복 join

    expect(dup.matched).toBe(false); // 두 번째 매칭이 생기지 않는다
    expect(rankQueueStore.attemptAllMatches()).toHaveLength(0); // c 도 a 와 안 붙는다
  });

  it('방 생성이 끝나면 다시 큐에 들어갈 수 있다', () => {
    rankQueueStore.enqueue(entry('b', 50, 1));
    rankQueueStore.enqueue(entry('a', 50, 2));
    rankQueueStore.releaseMatch('member-a', 'member-b');

    expect(rankQueueStore.isPendingMatch('member-a')).toBe(false);
    rankQueueStore.enqueue(entry('a', 50, 3));
    expect(rankQueueStore.enqueue(entry('c', 50, 4)).matched).toBe(true);
  });

  it('나간 사람은 매칭 대상에서 빠진다', () => {
    rankQueueStore.enqueue(entry('a', 50, 1));
    rankQueueStore.removeBySocket('sock-a');
    expect(rankQueueStore.enqueue(entry('b', 50, 2)).matched).toBe(false);
  });
});
