import { describe, it, expect } from 'vitest';
import {
  ANTE,
  BELL_FAIL,
  RTB_MIN_PLAYERS,
  actionFlags,
  apply,
  canSeat,
  createTable,
  displaySeats,
  drainKicks,
  dropBrokeGuilds,
  endSettleDisplay,
  isSetRunning,
  killPlayer,
  maskStateFor,
  seatPlayer,
  seatedCountForGuild,
  setGuildBalance,
  startNextSet,
  syncWaitAfterRosterChange,
  unseatPlayer,
  type RtbPlayer,
  type RtbState,
} from '@shared/guild-war/index.js';

function ok(res: ReturnType<typeof apply>): RtbState {
  if (!res.ok) throw new Error(res.error);
  return res.state;
}

function member(id: string, guildId: string): RtbPlayer {
  return {
    id,
    nickname: id,
    guildId,
    guildName: guildId,
    guildMarkUrl: '',
    isBot: false,
  };
}

function seatAll(rows: Array<[string, string]>, balance = 30): RtbState {
  let s = createTable();
  for (const [id, guildId] of rows) s = seatPlayer(s, member(id, guildId), balance);
  return s;
}

function finishLastSwaps(start: RtbState): RtbState {
  let s = start;
  for (let guard = 0; guard < 30; guard++) {
    if (
      s.phase !== 'last_swap' &&
      s.phase !== 'pick_source' &&
      s.phase !== 'discard' &&
      s.phase !== 'four_choice'
    ) {
      return s;
    }
    const id = s.currentId!;
    if (s.phase === 'four_choice') {
      s = ok(apply(s, id, { type: 'skip_four' }));
      continue;
    }
    s =
      s.phase === 'discard'
        ? ok(apply(s, id, { type: 'discard', cardId: s.hands[id]![4]!.id }))
        : ok(apply(s, id, { type: 'pick', source: 'deck' }));
  }
  throw new Error('마지막 교환이 끝나지 않음');
}

function submitRemainingCombos(start: RtbState): RtbState {
  let s = start;
  for (const p of s.players) {
    if (!s.alive[p.id] || s.combo[p.id] || s.comboTimedOut[p.id]) continue;
    s = ok(apply(s, p.id, { type: 'combo', cardIds: [s.hands[p.id]![0]!.id] }));
  }
  return s;
}

/** 봇 없이 한 세트를 끝까지 민다. 남은 사람은 전부 조합을 낸다. */
function playOutSet(start: RtbState): RtbState {
  let s = start;
  for (let guard = 0; guard < 500; guard++) {
    if (s.phase === 'idle' || s.phase === 'countdown') return s;
    if (s.phase === 'combo') {
      const who = s.players.find((p) => s.alive[p.id] && !s.combo[p.id] && !s.comboTimedOut[p.id]);
      if (!who) return s;
      const card = s.hands[who.id]![0]!;
      const r = apply(s, who.id, { type: 'combo', cardIds: [card.id] });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      continue;
    }
    const id = s.currentId!;
    if (s.phase === 'discard') {
      const r = apply(s, id, { type: 'discard', cardId: s.hands[id]![4]!.id });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      continue;
    }
    if (s.phase === 'four_choice') {
      const r = apply(s, id, { type: 'skip_four' });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      continue;
    }
    const r = apply(s, id, { type: 'pick', source: 'deck' });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  throw new Error('세트가 끝나지 않음');
}

describe('링 더 벨 엔진 (길드전)', () => {
  it('3명 미만이면 세트를 시작하지 않는다', () => {
    const s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2']]));
    expect(s.phase).toBe('idle');
    expect(s.players).toHaveLength(0);
  });

  it('3명이면 앤티 3씩 걷고 팟이 9가 된다', () => {
    const s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    expect(s.phase).toBe('turn');
    expect(s.pot).toBe(ANTE * RTB_MIN_PLAYERS);
    for (const p of s.players) expect(s.hands[p.id]).toHaveLength(4);
    expect(s.face).not.toBeNull();
  });

  it('같은 길드 칩이 모자라면 뒷사람만 빠진다', () => {
    // 같은 길드 2명 + 다른 길드 2명. 칩 3이면 같은 길드 앞 1명만 앤티를 낸다.
    let s = seatAll(
      [
        ['a', 'g1'],
        ['b', 'g1'],
        ['c', 'g2'],
        ['d', 'g3'],
      ],
      3,
    );
    s = setGuildBalance(s, 'g1', 3);
    s = startNextSet(s);
    const g1Seats = s.players.filter((p) => p.guildId === 'g1');
    expect(g1Seats.length).toBe(1);
    expect(s.players).toHaveLength(3);
  });

  it('같은 길드 착석은 2명까지다', () => {
    const s = seatAll([
      ['a', 'g1'],
      ['b', 'g1'],
      ['c', 'g1'],
    ]);
    expect(seatedCountForGuild(s, 'g1')).toBe(2);
    expect(s.roster.map((p) => p.id)).toEqual(['a', 'b']);
    expect(canSeat(s, 'g1')).toBe(false);
  });

  it('대기 화면은 착석 명단을 8칸에 놓는다', () => {
    const s = seatAll([
      ['a', 'g1'],
      ['b', 'g2'],
    ]);
    const seats = displaySeats(s);
    expect(seats).toHaveLength(8);
    expect(seats.slice(0, 2).map((p) => p?.id)).toEqual(['a', 'b']);
    expect(seats.slice(2).every((p) => p == null)).toBe(true);
  });

  it('세트 중 명단에 오른 사람은 빈칸에 다음으로 보인다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    s = seatPlayer(s, member('d', 'g4'), 30);
    const seats = displaySeats(s);
    expect(seats.filter((p) => p?.id === 'd')).toHaveLength(1);
    expect(s.players.some((p) => p.id === 'd')).toBe(false);
    expect(s.roster.some((p) => p.id === 'd')).toBe(true);
  });

  it('세트 중 나간 칸은 비우고 다음 세트 합류자가 채운다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    s = unseatPlayer(s, 'c');
    s = seatPlayer(s, member('d', 'g4'), 30);
    const seats = displaySeats(s);
    expect(seats.some((p) => p?.id === 'c')).toBe(false);
    expect(seats.some((p) => p?.id === 'd')).toBe(true);
  });

  it('카운트다운 중 인원이 모자라면 결과 화면으로 내리고 타이머는 유지한다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    s = playOutSet(s);
    expect(s.phase).toBe('countdown');
    const ends = s.countdownEndsAt;
    s = unseatPlayer(s, 'c');
    s = syncWaitAfterRosterChange(s);
    expect(s.phase).toBe('settle');
    expect(s.countdownEndsAt).toBe(ends);
  });

  it('관전자에게는 남의 손패와 덱 내용이 안 보인다', () => {
    const s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const masked = maskStateFor(s, 'a');
    expect(masked.hands.a).toEqual(s.hands.a);
    expect(masked.hands.b!.every((c) => c.rank === 0)).toBe(true);
    expect(masked.deck).toHaveLength(s.deck.length);
    expect(masked.deck.every((c) => c.rank === 0)).toBe(true);
  });

  it('세트가 끝나면 길드 델타 합이 0 이하다 (소멸분 포함)', () => {
    const s = playOutSet(startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']])));
    expect(s.settle).not.toBeNull();
    const sum = Object.values(s.settle!.guildDeltas).reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThanOrEqual(0);
    expect(sum + s.settle!.vanished).toBe(0);
  });

  it('세트가 끝난 뒤 좌석을 빼도 다시 정산하지 않는다', () => {
    const done = playOutSet(startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']])));
    const before = done.setIndex;
    const after = unseatPlayer(done, 'a');
    expect(after.setIndex).toBe(before);
    expect(after.settle).toEqual(done.settle);
    expect(after.roster.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('잔액 0 길드는 착석자 전원이 내려간다', () => {
    let s = seatAll([['a', 'g1'], ['b', 'g1'], ['c', 'g2']]);
    s = setGuildBalance(s, 'g1', 0);
    const { state, dropped } = dropBrokeGuilds(s);
    expect(dropped.sort()).toEqual(['a', 'b']);
    expect(state.roster.map((p) => p.id)).toEqual(['c']);
  });

  it('세트 중 퇴장은 다이로 처리한다', () => {
    const s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3'], ['d', 'g4']]));
    const victim = s.players.find((p) => p.id !== s.currentId)!.id;
    const next = killPlayer(s, victim, '퇴장');
    expect(next.alive[victim]).toBe(false);
  });

  it('생존이 1명이 되면 그 사람이 팟을 가져간다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const order = s.players.map((p) => p.id);
    const first = apply(s, order[0]!, { type: 'die' });
    expect(first.ok).toBe(true);
    s = (first as { state: RtbState }).state;
    const second = apply(s, s.currentId!, { type: 'die' });
    expect(second.ok).toBe(true);
    s = (second as { state: RtbState }).state;
    expect(s.settle?.kind).toBe('last_alive');
    expect(s.settle?.winners).toHaveLength(1);
  });

  it('턴 제한은 하위 단계를 합친 시간이다 (단계마다 리셋하지 않음)', () => {
    const s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const id = s.currentId!;
    const deadline = s.turnEndsAt;
    expect(deadline).not.toBeNull();

    const picked = ok(apply(s, id, { type: 'pick', source: 'deck' }));
    expect(picked.phase).toBe('discard');
    expect(picked.turnEndsAt).toBe(deadline);

    const dumped = ok(apply(picked, id, { type: 'discard', cardId: picked.hands[id]![4]!.id }));
    // 다음 사람 차례가 되면서 새로 잡힌다. 같은 사람 안에서는 안 바뀐다.
    expect(dumped.currentId).not.toBe(id);
  });

  it('앤티를 못 내면 강퇴 대상으로 보고한다', () => {
    let s = seatAll(
      [
        ['a', 'g1'],
        ['b', 'g1'],
        ['c', 'g2'],
        ['d', 'g3'],
      ],
      30,
    );
    s = setGuildBalance(s, 'g1', 3);
    s = startNextSet(s);
    expect(s.pendingKick.map((k) => k.reason)).toEqual(['ante']);
    const { state, kicks } = drainKicks(s);
    expect(kicks).toHaveLength(1);
    expect(state.pendingKick).toHaveLength(0);
  });

  it('앤티 도중 3명 미만이 되면 전액 롤백하고 대기로 간다', () => {
    // 세 길드 모두 칩은 있으나 앤티 3을 못 내는 길드가 둘.
    let s = seatAll(
      [
        ['a', 'g1'],
        ['b', 'g2'],
        ['c', 'g3'],
      ],
      3,
    );
    s = setGuildBalance(s, 'g1', 3);
    s = setGuildBalance(s, 'g2', 1);
    s = setGuildBalance(s, 'g3', 1);
    s = startNextSet(s);
    expect(s.phase).toBe('idle');
    expect(s.pot).toBe(0);
    expect(s.guilds.g1!.spent).toBe(0);
    expect(s.players).toHaveLength(0);
  });

  it('조합 타임아웃은 강퇴 대상이고, 벨이 미제출이면 2칩을 걷는다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const bell = s.currentId!;
    const bellGuild = s.players.find((p) => p.id === bell)!.guildId;
    const potAtBell = s.pot;

    s = ok(apply(s, bell, { type: 'bell' }));
    expect(s.bellId).toBe(bell);

    // 벨을 뺀 나머지가 마지막 교환을 한다.
    let guard = 0;
    while (s.phase === 'last_swap' || s.phase === 'pick_source' || s.phase === 'discard') {
      if (guard++ > 20) throw new Error('마지막 교환이 끝나지 않음');
      const id = s.currentId!;
      s =
        s.phase === 'discard'
          ? ok(apply(s, id, { type: 'discard', cardId: s.hands[id]![4]!.id }))
          : ok(apply(s, id, { type: 'pick', source: 'deck' }));
    }
    expect(s.phase).toBe('combo');

    // 벨만 제출하지 않는다.
    for (const p of s.players) {
      if (p.id === bell || !s.alive[p.id]) continue;
      s = ok(apply(s, p.id, { type: 'combo', cardIds: [s.hands[p.id]![0]!.id] }));
    }
    expect(s.phase).toBe('combo');

    s.hands[bell] = [
      { id: 'bw1', color: 'red', rank: 1 },
      { id: 'bw2', color: 'blue', rank: 2 },
      { id: 'bw3', color: 'green', rank: 3 },
      { id: 'bw4', color: 'yellow', rank: 4 },
    ];
    for (const p of s.players) {
      if (p.id === bell) continue;
      s.combo[p.id] = [{ id: `hi-${p.id}`, color: 'purple', rank: 10 }];
    }

    s = ok(apply(s, 'system', { type: 'timeout' }));
    expect(s.alive[bell]).toBe(true);
    expect(s.combo[bell]?.[0]?.rank).toBe(1);
    expect(s.settle?.kind).toBe('bell_fail');
    expect(s.nextFirstId).not.toBe(bell);
    expect(s.settle!.winners.some((w) => w.playerId === s.nextFirstId)).toBe(true);
    expect(s.pendingKick.some((k) => k.playerId === bell && k.reason === 'combo_timeout')).toBe(true);
    // 앤티 + 벨 실패 칩이 팟에 들어갔다.
    expect(s.settle!.potBefore).toBe(potAtBell + BELL_FAIL);
    // 벨 길드는 앤티 + 벌칙을 잃었다 (팟은 다른 사람이 가져감).
    expect(s.settle!.guildDeltas[bellGuild]).toBe(-(ANTE + BELL_FAIL));
  });

  it('가용 칩이 실패 벌칙보다 적으면 벨을 못 친다', () => {
    const s = startNextSet(
      seatAll(
        [
          ['a', 'g1'],
          ['b', 'g2'],
          ['c', 'g3'],
        ],
        ANTE + BELL_FAIL - 1,
      ),
    );
    const first = s.currentId!;
    expect(actionFlags(s, first).canBell).toBe(false);
    const res = apply(s, first, { type: 'bell' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(String(BELL_FAIL));
  });

  it('가용 칩이 실패 벌칙과 같으면 벨을 칠 수 있다', () => {
    const s = startNextSet(
      seatAll(
        [
          ['a', 'g1'],
          ['b', 'g2'],
          ['c', 'g3'],
        ],
        ANTE + BELL_FAIL,
      ),
    );
    const first = s.currentId!;
    expect(actionFlags(s, first).canBell).toBe(true);
    expect(apply(s, first, { type: 'bell' }).ok).toBe(true);
  });

  it('벨 성공 컷 N 에 조합 타임아웃 생존자가 들어간다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3'], ['d', 'g4']]));
    const bell = s.currentId!;
    s = ok(apply(s, bell, { type: 'bell' }));

    let guard = 0;
    while (
      s.phase === 'last_swap' ||
      s.phase === 'pick_source' ||
      s.phase === 'discard' ||
      s.phase === 'four_choice'
    ) {
      if (guard++ > 20) throw new Error('마지막 교환이 끝나지 않음');
      const id = s.currentId!;
      if (s.phase === 'four_choice') {
        s = ok(apply(s, id, { type: 'skip_four' }));
        continue;
      }
      s =
        s.phase === 'discard'
          ? ok(apply(s, id, { type: 'discard', cardId: s.hands[id]![4]!.id }))
          : ok(apply(s, id, { type: 'pick', source: 'deck' }));
    }
    expect(s.phase).toBe('combo');
    expect(s.players.filter((p) => s.alive[p.id])).toHaveLength(4);

    const others = s.players.filter((p) => p.id !== bell).map((p) => p.id);
    const [high, low, timed] = others;
    s.combo[bell] = [{ id: 'cb', color: 'red', rank: 5 }];
    s.combo[high!] = [{ id: 'ch', color: 'blue', rank: 10 }];
    s.combo[low!] = [{ id: 'cl', color: 'green', rank: 1 }];
    s.hands[timed!] = [
      { id: 't1', color: 'red', rank: 1 },
      { id: 't2', color: 'blue', rank: 9 },
      { id: 't3', color: 'green', rank: 8 },
      { id: 't4', color: 'yellow', rank: 7 },
    ];
    s = ok(apply(s, 'system', { type: 'timeout' }));

    expect(s.combo[timed!]?.[0]?.rank).toBe(1);
    expect(s.alive[timed!]).toBe(true);
    expect(s.settle?.kind).toBe('bell_success');
    expect(s.nextFirstId).toBe(bell);
    expect(s.pendingKick.some((k) => k.reason === 'combo_timeout')).toBe(true);
  });

  it('정산 전에는 남의 제출 조합이 가려진다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const me = s.currentId!;
    const other = s.players.find((p) => p.id !== me)!.id;
    s = ok(apply(s, me, { type: 'die' }));
    // die 로 생존 2가 되어도 세트는 계속된다. 조합 단계까지 밀지 않고 직접 확인한다.
    s.phase = 'combo';
    s.combo[other] = [s.hands[other]![0]!];

    const masked = maskStateFor(s, me);
    expect(masked.combo[other]).toHaveLength(1);
    expect(masked.combo[other]![0]!.rank).toBe(0);

    const own = maskStateFor(s, other);
    expect(own.combo[other]![0]!.rank).toBe(s.hands[other]![0]!.rank);
  });

  it('인원이 모자라면 정산 결과를 settle 로 보여 준 뒤 대기로 간다', () => {
    let s = seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]);
    s = playOutSet(startNextSet(s));
    // 두 명을 내리면 다음 세트를 못 여는 상태가 된다.
    s = unseatPlayer(unseatPlayer(s, 'b'), 'c');
    s = endSettleDisplay({ ...s, phase: 'settle', countdownEndsAt: Date.now() });
    expect(s.phase).toBe('idle');
    expect(s.settle).not.toBeNull();
  });

  it('settle 은 세트 진행 중이 아니다 (정산 두 번 방지)', () => {
    const done = playOutSet(startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']])));
    const inSettle: RtbState = { ...done, phase: 'settle' };
    expect(isSetRunning(inSettle)).toBe(false);
    const after = killPlayer(inSettle, 'a', '퇴장');
    expect(after.settle).toEqual(done.settle);
  });

  it('선은 1번 칸, 나머지 좌석은 매 세트 섞인다', () => {
    const rows: Array<[string, string]> = [
      ['a', 'g1'],
      ['b', 'g2'],
      ['c', 'g3'],
      ['d', 'g4'],
      ['e', 'g5'],
      ['f', 'g6'],
      ['g', 'g7'],
      ['h', 'g8'],
    ];
    const restOrders = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const s = startNextSet({ ...seatAll(rows), nextFirstId: 'a' });
      expect(s.players[0]!.id).toBe('a');
      expect(s.firstId).toBe('a');
      restOrders.add(s.players.slice(1).map((p) => p.id).join(','));
    }
    expect(restOrders.size).toBeGreaterThan(1);
  });

  it('팟을 먹은 사람이 다음 세트 선이 된다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    s = ok(apply(s, s.players[0]!.id, { type: 'die' }));
    s = ok(apply(s, s.currentId!, { type: 'die' }));
    expect(s.settle?.kind).toBe('last_alive');
    const winner = s.settle!.winners[0]!.playerId;
    expect(s.nextFirstId).toBe(winner);
    s = startNextSet(s);
    expect(s.players[0]!.id).toBe(winner);
    expect(s.firstId).toBe(winner);
  });

  it('공동 1등이면 그 세트에서 자리가 빠른 사람이 다음 선', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const [p0, p1, p2] = s.players;
    s = {
      ...s,
      phase: 'combo',
      bellId: null,
      currentId: null,
      combo: {},
      comboTimedOut: {},
      hands: {
        [p0!.id]: [{ id: 'h0', color: 'green', rank: 2 }],
        [p1!.id]: [{ id: 'h1', color: 'red', rank: 9 }],
        [p2!.id]: [{ id: 'h2', color: 'blue', rank: 9 }],
      },
    };
    s = ok(apply(s, p0!.id, { type: 'combo', cardIds: ['h0'] }));
    s = ok(apply(s, p1!.id, { type: 'combo', cardIds: ['h1'] }));
    s = ok(apply(s, p2!.id, { type: 'combo', cardIds: ['h2'] }));
    expect(s.settle?.kind).toBe('first');
    expect(s.nextFirstId).toBe(p1!.id);
  });

  it('벨 이후 마지막 교환 타임아웃은 다이가 아니라 랜덤 교환이다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const bell = s.currentId!;
    s = ok(apply(s, bell, { type: 'bell' }));
    expect(s.phase).toBe('last_swap');
    const who = s.currentId!;
    expect(who).not.toBe(bell);
    s = ok(apply(s, 'system', { type: 'timeout' }));
    expect(s.alive[who]).toBe(true);
    expect(s.hands[who]).toHaveLength(4);
    expect(s.pendingKick.some((k) => k.playerId === who && k.reason === 'turn_timeout')).toBe(true);
    expect(s.settle).toBeNull();
  });

  it('벨 이후 나가기는 다이로 세트를 끝내지 않는다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3'], ['d', 'g4']]));
    s = ok(apply(s, s.currentId!, { type: 'bell' }));
    const leaver = s.players.find((p) => p.id !== s.bellId && p.id !== s.currentId)!.id;
    s = unseatPlayer(s, leaver);
    expect(s.alive[leaver]).toBe(true);
    expect(s.roster.map((p) => p.id)).not.toContain(leaver);
    expect(s.settle).toBeNull();
    expect(s.hands[leaver]).toHaveLength(4);
  });

  it('벨 이후 나간 사람은 조합이 열릴 때 최저를 내서 판을 막지 않는다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3'], ['d', 'g4']]));
    s = ok(apply(s, s.currentId!, { type: 'bell' }));
    const leaver = s.players.find((p) => p.id !== s.bellId && p.id !== s.currentId)!.id;
    s = unseatPlayer(s, leaver);
    s = finishLastSwaps(s);
    expect(s.phase).toBe('combo');
    expect(s.combo[leaver]).toHaveLength(1);
    s = submitRemainingCombos(s);
    expect(s.settle).not.toBeNull();
  });

  it('벨을 친 뒤 나가면 조합이 열릴 때 최저를 낸다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    const bell = s.currentId!;
    s = ok(apply(s, bell, { type: 'bell' }));
    s = unseatPlayer(s, bell);
    expect(s.alive[bell]).toBe(true);
    s = finishLastSwaps(s);
    expect(s.phase).toBe('combo');
    expect(s.combo[bell]).toHaveLength(1);
    s = submitRemainingCombos(s);
    expect(s.settle).not.toBeNull();
  });

  it('벨 이후 마지막 교환 당사자가 나가면 바로 최저 조합을 낸다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    s = ok(apply(s, s.currentId!, { type: 'bell' }));
    const last = s.currentId!;
    s = unseatPlayer(s, last);
    expect(s.alive[last]).toBe(true);
    expect(s.phase === 'combo' || s.phase === 'last_swap').toBe(true);
    if (s.phase === 'last_swap') s = finishLastSwaps(s);
    expect(s.phase).toBe('combo');
    expect(s.combo[last]).toHaveLength(1);
    s = submitRemainingCombos(s);
    expect(s.settle).not.toBeNull();
  });

  it('벨 이후 카드 선택 중 타임아웃은 다이가 아니다', () => {
    let s = startNextSet(seatAll([['a', 'g1'], ['b', 'g2'], ['c', 'g3']]));
    s = ok(apply(s, s.currentId!, { type: 'bell' }));
    const who = s.currentId!;
    s = ok(apply(s, who, { type: 'swap' }));
    expect(s.phase).toBe('pick_source');
    s = ok(apply(s, 'system', { type: 'timeout' }));
    expect(s.alive[who]).toBe(true);
    expect(s.hands[who]).toHaveLength(4);
    expect(s.pendingKick.some((k) => k.playerId === who && k.reason === 'turn_timeout')).toBe(true);
    expect(s.settle).toBeNull();
  });
});
