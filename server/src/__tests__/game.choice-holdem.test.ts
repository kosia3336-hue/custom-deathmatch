import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { IO } from '../socket/types.js';
import { chooseChoiceHoldemAiAction } from '../socket/games/choice-holdem/ai.js';
import {
  beginChoiceHoldemRound,
  performChoiceHoldemAction,
} from '../socket/games/choice-holdem/engine.js';
import { cleanupChoiceHoldem, initChoiceHoldem } from '../socket/games/choice-holdem/index.js';
import { choiceHoldemStates, toChoiceHoldemGameData } from '../socket/games/choice-holdem/state.js';

const roomIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) cleanupChoiceHoldem(roomId);
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

function setup(roomId: string, secondId = 'second', playMode: 'multi' | 'com' = 'multi') {
  vi.useFakeTimers();
  roomIds.add(roomId);
  const first = player('first', '첫 번째');
  const second = player(secondId, secondId === AI_PLAYER_ID ? 'AI' : '두 번째');
  const io = ioStub();
  initChoiceHoldem(io, roomId, [first, second], playMode, Date.now(), null, vi.fn());
  return { io, first, second, state: choiceHoldemStates.get(roomId)! };
}

function checkThroughFirstBetting(
  io: IO,
  state: NonNullable<ReturnType<typeof choiceHoldemStates.get>>,
) {
  expect(performChoiceHoldemAction(io, state, state.firstPlayerId, { type: 'call' })).toBeNull();
  const selectorId = state.players.find((player) => player.id !== state.firstPlayerId)!.id;
  expect(performChoiceHoldemAction(io, state, selectorId, { type: 'call' })).toBeNull();
  expect(state.phase).toBe('arranging-choice');
}

function selectCards(io: IO, state: NonNullable<ReturnType<typeof choiceHoldemStates.get>>) {
  const selectorId = state.players.find((player) => player.id !== state.firstPlayerId)!.id;
  expect(
    performChoiceHoldemAction(io, state, state.firstPlayerId, {
      type: 'arrange-choice',
      faceUpIndex: 0,
    }),
  ).toBeNull();
  expect(
    performChoiceHoldemAction(io, state, selectorId, {
      type: 'pick-choice',
      choice: 'face-up',
    }),
  ).toBeNull();
}

describe('초이스 홀덤 경기 진행', () => {
  it('양쪽이 20칩에서 기본 베팅 1칩을 내고 1차 베팅을 시작한다', () => {
    const { state, first, second } = setup('choice-holdem-initial');
    expect(state.phase).toBe('first-betting');
    expect(state.pot).toBe(2);
    expect(state.playerStates[first.id]).toMatchObject({ chips: 19, roundBet: 1 });
    expect(state.playerStates[second.id]).toMatchObject({ chips: 19, roundBet: 1 });
    expect(state.communityCards).toHaveLength(3);
    expect(state.playerStates[first.id].cards).toHaveLength(1);
    expect(state.currentTurnId).toBe(first.id);
  });

  it('1차 베팅 뒤 선 플레이어가 앞면을 정하고 후 플레이어가 카드를 선택한다', () => {
    const { io, state, first, second } = setup('choice-holdem-choice');
    checkThroughFirstBetting(io, state);
    const firstView = toChoiceHoldemGameData(state, first.id);
    const secondViewBeforeArrange = toChoiceHoldemGameData(state, second.id);
    expect(firstView.choice.options).toHaveLength(2);
    expect(secondViewBeforeArrange.choice.options).toBeNull();

    performChoiceHoldemAction(io, state, first.id, { type: 'arrange-choice', faceUpIndex: 0 });
    const secondView = toChoiceHoldemGameData(state, second.id);
    expect(secondView.choice.faceUp).not.toBeNull();
    expect(secondView.choice.faceDown).toBeNull();
    performChoiceHoldemAction(io, state, second.id, { type: 'pick-choice', choice: 'face-up' });

    expect(state.phase).toBe('second-betting');
    expect(state.playerStates[first.id].cards).toHaveLength(2);
    expect(state.playerStates[second.id].cards).toHaveLength(2);
    expect(state.faceUpOwnerId).toBe(second.id);
    expect(toChoiceHoldemGameData(state, first.id).players[second.id].cards[1]).not.toBeNull();
  });

  it('레이즈는 상대가 콜할 수 있는 범위까지만 허용하고 콜 차액을 팟에 넣는다', () => {
    const { io, state, first, second } = setup('choice-holdem-raise');
    expect(performChoiceHoldemAction(io, state, first.id, { type: 'raise', amount: 4 })).toBeNull();
    expect(state.pot).toBe(5);
    expect(state.playerStates[first.id]).toMatchObject({ chips: 16, roundBet: 4 });
    expect(
      performChoiceHoldemAction(io, state, second.id, { type: 'raise', amount: 21 }),
    ).toContain('범위');
    expect(performChoiceHoldemAction(io, state, second.id, { type: 'call' })).toBeNull();
    expect(state.pot).toBe(8);
    expect(state.phase).toBe('arranging-choice');
  });

  it('폴드하면 개인 카드를 공개하지 않고 상대가 팟을 가져간다', () => {
    const { io, state, first, second } = setup('choice-holdem-fold');
    performChoiceHoldemAction(io, state, first.id, { type: 'fold' });
    expect(state.phase).toBe('round-result');
    expect(state.playerStates[second.id].chips).toBe(21);
    expect(state.pot).toBe(0);
    expect(state.lastRoundResult).toMatchObject({
      winnerId: second.id,
      foldedPlayerId: first.id,
      reason: 'fold',
      holeCards: null,
    });
  });

  it('완전 동률이면 팟과 선 플레이어를 유지하고 다음 딜의 모든 베팅을 생략한다', async () => {
    const { io, state, first, second } = setup('choice-holdem-tie');
    checkThroughFirstBetting(io, state);
    selectCards(io, state);
    state.communityCards = [1, 2, 3];
    state.playerStates[first.id].cards = [4, 5];
    state.playerStates[second.id].cards = [4, 5];
    performChoiceHoldemAction(io, state, first.id, { type: 'call' });
    performChoiceHoldemAction(io, state, second.id, { type: 'call' });

    expect(state.lastRoundResult?.reason).toBe('tie');
    expect(state.pot).toBe(2);
    expect(state.playerStates[first.id].chips).toBe(19);
    const retainedFirst = state.firstPlayerId;

    await vi.advanceTimersByTimeAsync(2400);
    expect(state.round).toBe(2);
    expect(state.carryRound).toBe(true);
    expect(state.phase).toBe('arranging-choice');
    expect(state.firstPlayerId).toBe(retainedFirst);
    expect(state.pot).toBe(2);
    expect(state.playerStates[first.id].roundBet).toBe(0);
    expect(state.playerStates[second.id].roundBet).toBe(0);
  });

  it('11라운드부터 기본 베팅이 2칩이며 이를 못 내는 플레이어가 패배한다', () => {
    const { io, state, first, second } = setup('choice-holdem-ante-lack');
    state.round = 11;
    state.carryRound = false;
    state.playerStates[first.id].chips = 1;
    state.playerStates[second.id].chips = 3;
    beginChoiceHoldemRound(io, state);
    expect(state.gameOver).toBe(true);
    expect(state.ante).toBe(2);
    expect(state.winnerId).toBe(second.id);
  });

  it('21라운드의 앤티 3칩보다 적은 2칩이면 차감 없이 패배한다', () => {
    const { io, state, first, second } = setup('choice-holdem-ante-three-lack');
    state.round = 21;
    state.pot = 0;
    state.playerStates[first.id].chips = 2;
    state.playerStates[second.id].chips = 8;
    beginChoiceHoldemRound(io, state);
    expect(state.ante).toBe(3);
    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(second.id);
    expect(state.playerStates[first.id].chips).toBe(2);
    expect(state.playerStates[second.id].chips).toBe(8);
    expect(state.pot).toBe(0);
  });

  it('앤티 3칩을 정확히 내면 잔여 0칩이어도 현재 라운드를 끝까지 진행한다', () => {
    const { io, state, first, second } = setup('choice-holdem-ante-three-exact');
    state.round = 21;
    state.pot = 0;
    state.playerStates[first.id].chips = 3;
    state.playerStates[second.id].chips = 8;
    beginChoiceHoldemRound(io, state);
    expect(state.gameOver).toBe(false);
    expect(state.playerStates[first.id].chips).toBe(0);
    expect(state.playerStates[second.id].chips).toBe(5);
    expect(state.pot).toBe(6);
    checkThroughFirstBetting(io, state);
    selectCards(io, state);
    expect(state.phase).toBe('second-betting');
    expect(performChoiceHoldemAction(io, state, first.id, { type: 'call' })).toBeNull();
    expect(performChoiceHoldemAction(io, state, second.id, { type: 'call' })).toBeNull();
    expect(state.phase).toBe('round-result');
    expect(state.lastRoundResult?.potAmount).toBe(6);
    expect(
      Object.values(state.playerStates).reduce((total, player) => total + player.chips, state.pot),
    ).toBe(11);
  });

  it('5칩에서 앤티 3칩을 내고 2칩이 남아도 패배하지 않는다', () => {
    const { io, state, first, second } = setup('choice-holdem-ante-leaves-two');
    state.round = 21;
    state.pot = 0;
    state.playerStates[first.id].chips = 5;
    state.playerStates[second.id].chips = 20;
    beginChoiceHoldemRound(io, state);
    expect(state.ante).toBe(3);
    expect(state.playerStates[first.id].chips).toBe(2);
    expect(state.phase).toBe('first-betting');
    expect(state.gameOver).toBe(false);
    expect(state.winnerId).toBeNull();
    checkThroughFirstBetting(io, state);
    selectCards(io, state);
    expect(state.phase).toBe('second-betting');
    expect(state.gameOver).toBe(false);
  });

  it.each(['first', 'second'] as const)(
    '%s 베팅에서 2칩으로 내려가도 판을 마치고 팟을 받아 다음 라운드에 참가할 수 있다',
    async (phase) => {
      const { io, state, first, second } = setup(`choice-holdem-low-chips-${phase}`);
      state.round = 21;
      state.pot = 0;
      state.playerStates[first.id].chips = 8;
      state.playerStates[second.id].chips = 20;
      const setWinningHand = () => {
        // 잔여 칩이 적은 플레이어가 스트레이트로 승리하도록 패를 고정한다.
        state.communityCards = [1, 2, 3];
        state.playerStates[first.id].cards = [4, 5];
        state.playerStates[second.id].cards = [1, 1];
      };
      beginChoiceHoldemRound(io, state);
      if (phase === 'second') {
        checkThroughFirstBetting(io, state);
        selectCards(io, state);
        setWinningHand();
      }
      expect(
        performChoiceHoldemAction(io, state, first.id, { type: 'raise', amount: 6 }),
      ).toBeNull();
      expect(state.playerStates[first.id].chips).toBe(2);
      expect(state.gameOver).toBe(false);
      expect(state.winnerId).toBeNull();
      expect(performChoiceHoldemAction(io, state, second.id, { type: 'call' })).toBeNull();
      if (phase === 'first') {
        selectCards(io, state);
        setWinningHand();
        expect(performChoiceHoldemAction(io, state, first.id, { type: 'call' })).toBeNull();
        expect(performChoiceHoldemAction(io, state, second.id, { type: 'call' })).toBeNull();
      }
      expect(state.phase).toBe('round-result');
      expect(state.gameOver).toBe(false);
      expect(state.lastRoundResult?.winnerId).toBe(first.id);
      expect(state.playerStates[first.id].chips).toBe(14);
      await vi.advanceTimersByTimeAsync(2400);
      expect(state.round).toBe(22);
      expect(state.phase).toBe('first-betting');
      expect(state.gameOver).toBe(false);
      expect(state.playerStates[first.id].chips).toBe(11);
    },
  );

  it('동률 이월 라운드는 잔여 2칩이어도 앤티 3칩을 다시 요구하지 않는다', () => {
    const { io, state, first, second } = setup('choice-holdem-carry-low-chips');
    state.round = 21;
    state.carryRound = true;
    state.pot = 6;
    state.playerStates[first.id].chips = 2;
    state.playerStates[second.id].chips = 8;
    beginChoiceHoldemRound(io, state);
    expect(state.gameOver).toBe(false);
    expect(state.phase).toBe('arranging-choice');
    expect(state.pot).toBe(6);
    expect(state.playerStates[first.id].chips).toBe(2);
    expect(state.playerStates[first.id].roundBet).toBe(0);
    expect(state.playerStates[second.id].chips).toBe(8);
  });

  it('후 플레이어 COM은 실제 뒷면 값이 달라도 같은 공개 정보로 선택한다', () => {
    const { state } = setup('choice-holdem-ai-hidden', AI_PLAYER_ID, 'com');
    state.phase = 'choosing-card';
    state.currentTurnId = AI_PLAYER_ID;
    state.faceUpIndex = 0;
    state.choiceCards = [3, 1];
    const firstChoice = chooseChoiceHoldemAiAction(state);
    state.choiceCards = [3, 5];
    const secondChoice = chooseChoiceHoldemAiAction(state);
    expect(firstChoice).toEqual(secondChoice);
  });
});
