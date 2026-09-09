import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ABSTRACT_AI_DIFFICULTY,
  GAME_IDS,
  isAbstractStrategyGameId,
  resolveAbstractAiDifficulty,
} from '@shared/types/game.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import { cleanupFourGravity, initFourGravity } from '../socket/games/four-gravity/index.js';
import { gameStates as fourGravityStates } from '../socket/games/four-gravity/state.js';
import {
  cleanupDoubleSidedChess,
  initDoubleSidedChess,
} from '../socket/games/double-sided-chess/index.js';
import { gameStates as doubleSidedChessStates } from '../socket/games/double-sided-chess/state.js';
import type { IO } from '../socket/types.js';

const roomIds = new Set<string>();

afterEach(() => {
  for (const roomId of roomIds) {
    cleanupFourGravity(roomId);
    cleanupDoubleSidedChess(roomId);
  }
  roomIds.clear();
  vi.restoreAllMocks();
});

function player(id: string, nickname: string): Player {
  return {
    id,
    nickname,
    isHost: id !== AI_PLAYER_ID,
    isReady: true,
    joinedAt: Date.now(),
  };
}

function ioStub() {
  return {
    in: () => ({ fetchSockets: async () => [] }),
  } as unknown as IO;
}

describe('추상전략 AI 난이도 계약', () => {
  it('사중력과 양면장기만 추상전략 난이도 대상으로 분류한다', () => {
    expect(isAbstractStrategyGameId(GAME_IDS.FOUR_GRAVITY)).toBe(true);
    expect(isAbstractStrategyGameId(GAME_IDS.DOUBLE_SIDED_CHESS)).toBe(true);
    expect(isAbstractStrategyGameId(GAME_IDS.BANK_GAME)).toBe(false);
  });

  it('보통을 기본값으로 사용하고 어려움만 명시적으로 허용한다', () => {
    expect(DEFAULT_ABSTRACT_AI_DIFFICULTY).toBe('normal');
    expect(resolveAbstractAiDifficulty(undefined)).toBe('normal');
    expect(resolveAbstractAiDifficulty('easy')).toBe('normal');
    expect(resolveAbstractAiDifficulty('hard')).toBe('hard');
  });

  it('사중력 COM 어려움 요청은 일시적으로 보통으로 제한한다', () => {
    const normalRoomId = 'four-gravity-normal-ai';
    const hardRoomId = 'four-gravity-hard-ai';
    roomIds.add(normalRoomId);
    roomIds.add(hardRoomId);
    const players = [player('human-four', '사람'), player(AI_PLAYER_ID, 'AI')];

    initFourGravity(ioStub(), normalRoomId, players, 'com', Date.now(), null, vi.fn());
    initFourGravity(ioStub(), hardRoomId, players, 'com', Date.now(), null, vi.fn(), {
      aiDifficulty: 'hard',
    });

    expect(fourGravityStates.get(normalRoomId)?.aiDifficulty).toBe('normal');
    expect(fourGravityStates.get(hardRoomId)?.aiDifficulty).toBe('normal');
  });

  it('양면장기 COM 어려움 요청은 일시적으로 보통으로 제한한다', () => {
    const roomId = 'double-sided-chess-hard-ai';
    roomIds.add(roomId);
    const players = [player('human-chess', '사람'), player(AI_PLAYER_ID, 'AI')];

    initDoubleSidedChess(ioStub(), roomId, players, 'com', Date.now(), null, vi.fn(), {
      aiDifficulty: 'hard',
    });

    expect(doubleSidedChessStates.get(roomId)?.aiDifficulty).toBe('normal');
  });
});
