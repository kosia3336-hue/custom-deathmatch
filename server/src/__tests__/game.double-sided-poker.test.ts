import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DoubleSidedPokerCard } from '@shared/types/double-sided-poker.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import type { IO } from '../socket/types.js';
import { chooseDoubleSidedPokerAiAction } from '../socket/games/double-sided-poker/ai.js';
import { createDoubleSidedPokerDeck } from '../socket/games/double-sided-poker/deck.js';
import { performDoubleSidedPokerAction } from '../socket/games/double-sided-poker/engine.js';
import {
  cleanupDoubleSidedPoker,
  initDoubleSidedPoker,
} from '../socket/games/double-sided-poker/index.js';
import {
  doubleSidedPokerStates,
  toDoubleSidedPokerGameData,
} from '../socket/games/double-sided-poker/state.js';

const roomIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupDoubleSidedPoker(roomId);
  roomIds.clear();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: false, isReady: true, joinedAt: Date.now() };
}

function ioStub() {
  return { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
}

function card(id: string, front: number, back: number): DoubleSidedPokerCard {
  return { id, set: 1, front, back };
}

function setup(roomId: string) {
  vi.useFakeTimers();
  roomIds.add(roomId);
  const first = player('first', '첫 번째');
  const second = player('second', '두 번째');
  const io = ioStub();
  initDoubleSidedPoker(io, roomId, [first, second], 'multi', Date.now(), null, vi.fn());
  return { io, first, second, state: doubleSidedPokerStates.get(roomId)! };
}

function setupCom(roomId: string) {
  vi.useFakeTimers();
  roomIds.add(roomId);
  const first = player('first', '플레이어');
  const second = player(AI_PLAYER_ID, 'AI');
  const io = ioStub();
  initDoubleSidedPoker(io, roomId, [first, second], 'com', Date.now(), null, vi.fn());
  return { io, first, second, state: doubleSidedPokerStates.get(roomId)! };
}

describe('양면포커 덱', () => {
  it('반대 홀짝의 50장 세트 네 벌로 총 200장을 만든다', () => {
    const deck = createDoubleSidedPokerDeck();
    expect(deck).toHaveLength(200);
    expect(new Set(deck.map((item) => item.id)).size).toBe(200);
    for (let set = 1; set <= 4; set += 1) {
      const cards = deck.filter((item) => item.set === set);
      expect(cards).toHaveLength(50);
      for (let front = 1; front <= 10; front += 1) {
        expect(cards.filter((item) => item.front === front)).toHaveLength(5);
      }
    }
    expect(deck.every((item) => item.front % 2 !== item.back % 2)).toBe(true);
    for (let value = 1; value <= 10; value += 1) {
      const faceCount = deck.reduce(
        (sum, item) => sum + Number(item.front === value) + Number(item.back === value),
        0,
      );
      expect(faceCount).toBe(40);
    }
  });
});

describe('양면포커 경기 진행', () => {
  it('각자 25칩에서 기본 베팅 1칩을 내고 앞면만 공개한다', () => {
    const { state, first, second } = setup('double-poker-initial');
    expect(state.deck).toHaveLength(198);
    expect(state.pot).toBe(2);
    expect(state.playerStates[first.id].chips).toBe(24);
    expect(state.playerStates[second.id].chips).toBe(24);
    const firstView = toDoubleSidedPokerGameData(state, first.id);
    const secondView = toDoubleSidedPokerGameData(state, second.id);
    const spectatorView = toDoubleSidedPokerGameData(state, null);
    expect(firstView.players[first.id].card?.back).toBeTypeOf('number');
    expect(firstView.players[second.id].card?.back).toBeNull();
    expect(secondView.players[first.id].card?.back).toBeNull();
    expect(spectatorView.players[first.id].card?.back).toBeNull();
    expect(spectatorView.players[second.id].card?.back).toBeNull();
  });

  it('체크와 0칩 베팅을 거부하고 최소 1칩 베팅 뒤 콜로 승부한다', () => {
    const { io, state, first, second } = setup('double-poker-normal');
    state.playerStates[first.id].card = card('a', 8, 3);
    state.playerStates[second.id].card = card('b', 6, 9);
    expect(performDoubleSidedPokerAction(io, state, first.id, { type: 'call' })).toContain('먼저');
    expect(
      performDoubleSidedPokerAction(io, state, first.id, {
        type: 'bet',
        side: 'front',
        amount: 0,
      }),
    ).toContain('가능한 범위');
    expect(
      performDoubleSidedPokerAction(io, state, first.id, {
        type: 'bet',
        side: 'front',
        amount: 1,
      }),
    ).toBeNull();
    expect(
      performDoubleSidedPokerAction(io, state, second.id, { type: 'call', side: 'front' }),
    ).toBeNull();
    expect(state.lastRoundResult).toMatchObject({
      winnerId: first.id,
      reason: 'showdown',
      potAmount: 4,
    });
    expect(state.lastRoundResult?.cards[first.id].back).toBeNull();
    expect(state.lastRoundResult?.cards[second.id].back).toBeNull();
  });

  it('뒷면을 선택한 플레이어의 뒷면만 승부 결과에 공개한다', () => {
    const { io, state, first, second } = setup('double-poker-back-reveal');
    state.playerStates[first.id].card = card('a', 2, 9);
    state.playerStates[second.id].card = card('b', 8, 1);
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'back', amount: 1 });
    performDoubleSidedPokerAction(io, state, second.id, { type: 'call', side: 'front' });
    expect(state.lastRoundResult?.cards[first.id].back).toBe(9);
    expect(state.lastRoundResult?.cards[second.id].back).toBeNull();
  });

  it('동점이면 팟을 유지하고 다음 라운드 기본 베팅을 더한다', async () => {
    const { io, state, first, second } = setup('double-poker-tie');
    state.playerStates[first.id].card = card('a', 5, 2);
    state.playerStates[second.id].card = card('b', 5, 8);
    const previousFirst = state.firstPlayerId;
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'front', amount: 1 });
    performDoubleSidedPokerAction(io, state, second.id, { type: 'call', side: 'front' });
    expect(state.lastRoundResult?.reason).toBe('tie');
    expect(state.pot).toBe(4);

    await vi.advanceTimersByTimeAsync(2800);
    expect(state.round).toBe(2);
    expect(state.carryRound).toBe(true);
    expect(state.firstPlayerId).not.toBe(previousFirst);
    expect(state.pot).toBe(6);
  });

  it('양면베팅은 양쪽 베팅칸에 같은 칩을 내고 상대 응답을 기다린다', () => {
    const { io, state, first, second } = setup('double-poker-double-wait');
    state.playerStates[first.id].card = card('a', 5, 2);
    state.playerStates[second.id].card = card('b', 8, 7);
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'front', amount: 2 });
    expect(performDoubleSidedPokerAction(io, state, second.id, { type: 'double' })).toBeNull();
    expect(state.phase).toBe('betting');
    expect(state.currentTurnId).toBe(first.id);
    expect(state.playerStates[second.id]).toMatchObject({
      selection: 'both',
      stake: 2,
      frontBet: 2,
      backBet: 2,
      chips: 20,
    });
    expect(state.pot).toBe(8);
  });

  it('양면베팅 성공 시 팟과 추가 10칩을 가져온다', () => {
    const { io, state, first, second } = setup('double-poker-double-bonus');
    state.playerStates[first.id].card = card('a', 5, 2);
    state.playerStates[second.id].card = card('b', 8, 7);
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'front', amount: 1 });
    performDoubleSidedPokerAction(io, state, second.id, { type: 'double' });
    performDoubleSidedPokerAction(io, state, first.id, { type: 'call' });
    expect(state.lastRoundResult).toMatchObject({
      winnerId: second.id,
      doubleBettorId: second.id,
      doubleBonus: 10,
    });
    expect(state.playerStates[first.id].chips).toBe(13);
    expect(state.playerStates[second.id].chips).toBe(37);
  });

  it('양면 중 한 숫자가 같아도 양면베팅자가 패배한다', () => {
    const { io, state, first, second } = setup('double-poker-double-equal');
    state.playerStates[first.id].card = card('a', 6, 1);
    state.playerStates[second.id].card = card('b', 6, 9);
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'front', amount: 1 });
    performDoubleSidedPokerAction(io, state, second.id, { type: 'double' });
    performDoubleSidedPokerAction(io, state, first.id, { type: 'call' });
    expect(state.lastRoundResult).toMatchObject({ winnerId: first.id, doubleBonus: 0 });
  });

  it('양면베팅 뒤 상대가 레이즈하면 양면 차액을 각각 콜한다', () => {
    const { io, state, first, second } = setup('double-poker-double-raise');
    state.playerStates[first.id].card = card('a', 5, 2);
    state.playerStates[second.id].card = card('b', 8, 7);
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'front', amount: 2 });
    performDoubleSidedPokerAction(io, state, second.id, { type: 'double' });
    performDoubleSidedPokerAction(io, state, first.id, { type: 'raise', amount: 3 });
    expect(state.currentTurnId).toBe(second.id);
    expect(performDoubleSidedPokerAction(io, state, second.id, { type: 'call' })).toBeNull();
    expect(state.lastRoundResult?.actions.at(-1)).toMatchObject({ payment: 2, stake: 3 });
    expect(state.lastRoundResult?.bets[second.id]).toEqual({ front: 3, back: 3 });
  });

  it('양면베팅을 받은 상대가 다이해도 양면베팅자가 추가 칩을 가져온다', () => {
    const { io, state, first, second } = setup('double-poker-double-fold-bonus');
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'front', amount: 1 });
    performDoubleSidedPokerAction(io, state, second.id, { type: 'double' });
    performDoubleSidedPokerAction(io, state, first.id, { type: 'fold' });
    expect(state.lastRoundResult).toMatchObject({
      winnerId: second.id,
      reason: 'fold',
      doubleBonus: 10,
    });
    expect(state.lastRoundResult?.cards[first.id].back).toBeNull();
    expect(state.lastRoundResult?.cards[second.id].back).toBeNull();
  });

  it('COM은 상대의 실제 비공개 뒷면이 아니라 공개 앞면의 분포만 사용한다', () => {
    const { io, state, first } = setupCom('double-poker-ai-privacy');
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    state.playerStates[first.id].card = card('human-a', 5, 2);
    state.playerStates[AI_PLAYER_ID].card = card('ai', 8, 7);
    performDoubleSidedPokerAction(io, state, first.id, { type: 'bet', side: 'back', amount: 1 });
    const withLowHiddenBack = chooseDoubleSidedPokerAiAction(state);
    state.playerStates[first.id].card = card('human-b', 5, 10);
    const withHighHiddenBack = chooseDoubleSidedPokerAiAction(state);
    expect(withHighHiddenBack).toEqual(withLowHiddenBack);
  });
});
