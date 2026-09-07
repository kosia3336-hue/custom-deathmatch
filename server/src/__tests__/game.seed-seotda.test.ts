import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SeedSeotdaCard } from '@shared/types/seed-seotda.js';
import type { Player } from '@shared/types/room.js';
import type { IO } from '../socket/types.js';
import { createSeedSeotdaDeck } from '../socket/games/seed-seotda/deck.js';
import {
  performSeedSeotdaAction,
  resolveSeedSeotdaShowdown,
} from '../socket/games/seed-seotda/engine.js';
import { cleanupSeedSeotda, initSeedSeotda } from '../socket/games/seed-seotda/index.js';
import {
  compareSeedSeotdaHands,
  evaluateSeedSeotdaHand,
} from '../socket/games/seed-seotda/judge.js';
import { seedSeotdaStates, toSeedSeotdaGameData } from '../socket/games/seed-seotda/state.js';

const roomIds = new Set<string>();
const deck = createSeedSeotdaDeck();

afterEach(() => {
  for (const roomId of roomIds) cleanupSeedSeotda(roomId);
  roomIds.clear();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function card(id: string): SeedSeotdaCard {
  const found = deck.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`카드를 찾을 수 없습니다: ${id}`);
  return { ...found };
}

function hand(left: string, right: string) {
  return evaluateSeedSeotdaHand([card(left), card(right)]);
}

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: false, isReady: true, joinedAt: Date.now() };
}

function ioStub() {
  return { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
}

function setup(roomId: string) {
  vi.useFakeTimers();
  roomIds.add(roomId);
  const first = player('first', '첫 번째');
  const second = player('second', '두 번째');
  const io = ioStub();
  initSeedSeotda(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
  return { io, first, second, state: seedSeotdaStates.get(roomId)! };
}

describe('시드섯다 덱과 족보', () => {
  it('1~10월 카드가 월마다 두 장씩 총 20장이다', () => {
    expect(deck).toHaveLength(20);
    expect(new Set(deck.map((item) => item.id)).size).toBe(20);
    for (let month = 1; month <= 10; month += 1) {
      expect(deck.filter((item) => item.month === month)).toHaveLength(2);
    }
    expect(card('1a').kind).toBe('bright');
    expect(card('8b').kind).toBe('animal');
    expect(card('10b').kind).toBe('ribbon');
  });

  it('기본 족보를 삼팔광땡부터 망통까지 판정한다', () => {
    expect(hand('3a', '8a').name).toBe('삼팔광땡');
    expect(hand('1a', '3a').name).toBe('일삼광땡');
    expect(hand('10a', '10b').name).toBe('장땡');
    expect(hand('1a', '2a').name).toBe('알리');
    expect(hand('4b', '6b').name).toBe('세륙');
    expect(hand('2a', '7b').name).toBe('갑오');
    expect(hand('2b', '8b').name).toBe('망통');
  });

  it('암행어사와 땡잡이는 지정한 상대 족보만 이긴다', () => {
    const amhaeng = hand('4a', '7a');
    expect(compareSeedSeotdaHands(amhaeng, hand('1a', '3a')).comparison).toBe(1);
    expect(compareSeedSeotdaHands(amhaeng, hand('3a', '8a')).comparison).toBe(-1);

    const catcher = hand('3a', '7a');
    expect(compareSeedSeotdaHands(catcher, hand('9a', '9b')).comparison).toBe(1);
    expect(compareSeedSeotdaHands(catcher, hand('10a', '10b')).comparison).toBe(-1);
  });

  it('구사와 멍텅구리 구사는 상대 족보 임계값에 따라 재경기한다', () => {
    const gusa = hand('4b', '9b');
    expect(compareSeedSeotdaHands(gusa, hand('1a', '2b')).reason).toBe('gusa-rematch');
    expect(compareSeedSeotdaHands(gusa, hand('1a', '1b')).comparison).toBe(-1);

    const mung = hand('4a', '9a');
    expect(compareSeedSeotdaHands(mung, hand('10a', '10b')).reason).toBe('mung-gusa-rematch');
    expect(compareSeedSeotdaHands(mung, hand('1a', '8a')).comparison).toBe(-1);
  });
});

  it('3월과 7월이면 그림 종류와 상관없이 모두 땡잡이다', () => {
    // 3광 + 7월 열자리 (원래 인정되던 조합)
    expect(hand('3a', '7a').name).toBe('땡잡이');
    // 3월 띠 + 7월 열자리 — 예전에는 망통(3+7=10)으로 빠졌다
    expect(hand('3b', '7a').name).toBe('땡잡이');
    expect(hand('3a', '7b').name).toBe('땡잡이');
    expect(hand('3b', '7b').name).toBe('땡잡이');
  });

  it('암행어사와 땡잡이는 정해진 그림 조합이다', () => {
    // 암행어사 = 4월 열자리(새) + 7월 열자리(멧돼지)
    expect(hand('4a', '7a').name).toBe('암행어사');
    // 4월 띠가 섞이면 암행어사가 아니다 (4+7=11 → 1끗)
    expect(hand('4b', '7a').name).toBe('1끗');
  });

  it('두 월의 합 끝수가 9면 아홉끗이 아니라 갑오다', () => {
    expect(hand('4a', '5a').name).toBe('갑오');
    expect(hand('2a', '7a').name).toBe('갑오');
  });

describe('시드섯다 경기 진행', () => {
  it('시드 1장, 선 2장, 후 2장을 나누고 기본 베팅을 받는다', () => {
    const { state, first, second } = setup('seed-seotda-initial');
    expect(state.phase).toBe('seed-choice');
    expect(state.seedCard).not.toBeNull();
    expect(state.playerStates[first.id].cards).toHaveLength(2);
    expect(state.playerStates[second.id].cards).toHaveLength(2);
    expect(state.deck).toHaveLength(15);
    expect(state.pot).toBe(2);
    expect(state.playerStates[first.id]).toMatchObject({ chips: 19, roundBet: 1 });
    // 패 버리기는 동시 제출이라 '누구 차례' 가 없다.
    expect(state.currentTurnId).toBeNull();
  });

  it('제출한 뒤에도 둘 다 낼 때까지 상대에게는 선택이 보이지 않는다', () => {
    const { io, state, first, second } = setup('seed-seotda-privacy');
    const firstCards = [...state.playerStates[first.id].cards];
    expect(
      performSeedSeotdaAction(io, state, first.id, { type: 'use-seed', discardIndex: 0 }),
    ).toBeNull();
    // 아직 상대가 안 냈으므로 무엇을 골랐는지 감춘다.
    expect(toSeedSeotdaGameData(state, second.id).players[first.id].seedChoice).toBe('pending');
    // 둘 다 내면 함께 열린다.
    performSeedSeotdaAction(io, state, second.id, { type: 'skip-seed' });
    expect(toSeedSeotdaGameData(state, second.id).players[first.id].seedChoice).toBe('used');

    const secondView = toSeedSeotdaGameData(state, second.id);
    expect(secondView.players[first.id].cards).toEqual([null, null]);
    expect(secondView.players[first.id].finalHand).toEqual([null, null]);
    expect(secondView.players[first.id].evaluation).toBeNull();
    expect(secondView.players[first.id]).not.toHaveProperty('discardIndex');
    expect(state.playerStates[first.id].finalHand[1]?.id).toBe(firstCards[1]?.id);

    const firstView = toSeedSeotdaGameData(state, first.id);
    expect(firstView.players[first.id].evaluation?.name).toBe(
      evaluateSeedSeotdaHand(state.playerStates[first.id].finalHand).name,
    );
  });

  it('패 버리기는 동시 제출이라 후 플레이어가 먼저 내도 받는다', () => {
    const { io, state, first, second } = setup('seed-seotda-simultaneous');
    // 선을 기다리지 않고 후가 먼저 낼 수 있다.
    expect(performSeedSeotdaAction(io, state, second.id, { type: 'skip-seed' })).toBeNull();
    expect(state.phase).toBe('seed-choice');
    // 같은 사람이 두 번 낼 수는 없다.
    expect(performSeedSeotdaAction(io, state, second.id, { type: 'skip-seed' })).toBe(
      '이미 제출했습니다.',
    );
    expect(performSeedSeotdaAction(io, state, first.id, { type: 'skip-seed' })).toBeNull();
    expect(state.phase).toBe('betting');
    expect(state.currentTurnId).toBe(state.firstPlayerId);
  });

  it('제한시간이 지나면 아직 안 낸 사람만 버리지 않은 것으로 처리한다', async () => {
    vi.useFakeTimers();
    roomIds.add('seed-seotda-timeout');
    const io = ioStub();
    const first = player('first', '첫 번째');
    const second = player('second', '두 번째');
    initSeedSeotda(io, 'seed-seotda-timeout', [first, second], 'multi', Date.now(), 30, vi.fn());
    const state = seedSeotdaStates.get('seed-seotda-timeout')!;
    performSeedSeotdaAction(io, state, first.id, { type: 'use-seed', discardIndex: 1 });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.playerStates[first.id].seedChoice).toBe('used');
    expect(state.playerStates[second.id].seedChoice).toBe('unused');
    expect(state.phase).toBe('betting');
  });

  it('양쪽 시드 선택 뒤 선 플레이어가 베팅하고 상대가 콜하면 승부한다', () => {
    const { io, state, first, second } = setup('seed-seotda-betting');
    performSeedSeotdaAction(io, state, first.id, { type: 'skip-seed' });
    performSeedSeotdaAction(io, state, second.id, { type: 'skip-seed' });
    expect(state.phase).toBe('betting');
    expect(performSeedSeotdaAction(io, state, first.id, { type: 'call' })).toContain('먼저');
    expect(performSeedSeotdaAction(io, state, first.id, { type: 'bet', amount: 2 })).toBeNull();
    expect(state.pot).toBe(4);
    expect(performSeedSeotdaAction(io, state, second.id, { type: 'call' })).toBeNull();
    expect(state.phase).toBe('round-result');
    expect(state.lastRoundResult?.actions.map((action) => action.action)).toEqual(['bet', 'call']);
  });

  it('더 높은 패로 다이하면 5칩을 더 주고 다이한 패만 공개한다', () => {
    const { io, state, first, second } = setup('seed-seotda-die-penalty');
    state.phase = 'betting';
    state.currentTurnId = first.id;
    state.bettingOpened = true;
    state.playerStates[first.id].finalHand = [card('3a'), card('8a')];
    state.playerStates[first.id].seedChoice = 'unused';
    state.playerStates[second.id].finalHand = [card('2a'), card('8b')];
    state.playerStates[second.id].seedChoice = 'unused';

    expect(performSeedSeotdaAction(io, state, first.id, { type: 'die' })).toBeNull();
    expect(state.lastRoundResult?.diePenalty).toBe(5);
    expect(state.lastRoundResult?.hands[first.id]).toHaveLength(2);
    expect(state.lastRoundResult?.hands[second.id]).toBeNull();
    expect(state.playerStates[first.id].chips).toBe(14);
    expect(state.playerStates[second.id].chips).toBe(26);
  });

  it('구사 재경기 대상 패로 다이하면 추가 패널티가 없다', () => {
    const { io, state, first, second } = setup('seed-seotda-die-gusa');
    state.phase = 'betting';
    state.currentTurnId = first.id;
    state.bettingOpened = true;
    state.playerStates[first.id].finalHand = [card('4b'), card('9b')];
    state.playerStates[first.id].seedChoice = 'unused';
    state.playerStates[second.id].finalHand = [card('1b'), card('2b')];
    state.playerStates[second.id].seedChoice = 'unused';

    performSeedSeotdaAction(io, state, first.id, { type: 'die' });
    expect(state.lastRoundResult?.diePenalty).toBe(0);
    expect(state.playerStates[first.id].chips).toBe(19);
    expect(state.playerStates[second.id].chips).toBe(21);
  });

  it('정상 승부의 승자가 다음 라운드 선 플레이어가 된다', async () => {
    const { io, state, first, second } = setup('seed-seotda-winner-first');
    const previousFirst = state.firstPlayerId;
    const previousSecond = previousFirst === first.id ? second.id : first.id;
    state.playerStates[previousFirst].finalHand = [card('2a'), card('8b')];
    state.playerStates[previousFirst].seedChoice = 'unused';
    state.playerStates[previousSecond].finalHand = [card('3a'), card('8a')];
    state.playerStates[previousSecond].seedChoice = 'unused';

    resolveSeedSeotdaShowdown(io, state);
    expect(state.lastRoundResult?.winnerId).toBe(previousSecond);

    await vi.advanceTimersByTimeAsync(2800);
    expect(state.round).toBe(2);
    expect(state.firstPlayerId).toBe(previousSecond);
  });

  it('상대가 다이해 얻은 승자도 다음 라운드 선 플레이어가 된다', async () => {
    const { io, state, first, second } = setup('seed-seotda-die-winner-first');
    const previousFirst = state.firstPlayerId;
    const previousSecond = previousFirst === first.id ? second.id : first.id;
    state.phase = 'betting';
    state.currentTurnId = previousSecond;
    state.bettingOpened = true;
    state.playerStates[previousFirst].finalHand = [card('1a'), card('2a')];
    state.playerStates[previousFirst].seedChoice = 'unused';
    state.playerStates[previousSecond].finalHand = [card('2a'), card('8b')];
    state.playerStates[previousSecond].seedChoice = 'unused';

    expect(performSeedSeotdaAction(io, state, previousSecond, { type: 'die' })).toBeNull();
    expect(state.lastRoundResult?.winnerId).toBe(previousFirst);

    await vi.advanceTimersByTimeAsync(2800);
    expect(state.round).toBe(2);
    expect(state.firstPlayerId).toBe(previousFirst);
  });

  it('상대 구사는 1땡 이상, 상대 멍텅구리 구사는 광땡 이상이면 이긴다', () => {
    expect(compareSeedSeotdaHands(hand('1a', '1b'), hand('4b', '9b'))).toMatchObject({
      comparison: 1,
      reason: 'showdown',
    });
    expect(compareSeedSeotdaHands(hand('1a', '8a'), hand('4a', '9a'))).toMatchObject({
      comparison: 1,
      reason: 'showdown',
    });
  });

  it('동일 족보면 팟과 선 플레이어를 유지하고 기본 베팅 없이 재경기한다', async () => {
    const { io, state, first, second } = setup('seed-seotda-replay');
    state.playerStates[first.id].finalHand = [card('2a'), card('7a')];
    state.playerStates[first.id].seedChoice = 'unused';
    state.playerStates[second.id].finalHand = [card('2b'), card('7b')];
    state.playerStates[second.id].seedChoice = 'unused';
    const retainedFirst = state.firstPlayerId;
    resolveSeedSeotdaShowdown(io, state);
    expect(state.lastRoundResult?.reason).toBe('tie');
    expect(state.pot).toBe(2);

    await vi.advanceTimersByTimeAsync(2800);
    expect(state.round).toBe(2);
    expect(state.carryRound).toBe(true);
    expect(state.firstPlayerId).toBe(retainedFirst);
    expect(state.pot).toBe(2);
    expect(state.playerStates[first.id]).toMatchObject({ chips: 19, roundBet: 0 });
    expect(state.playerStates[second.id]).toMatchObject({ chips: 19, roundBet: 0 });
  });
});
