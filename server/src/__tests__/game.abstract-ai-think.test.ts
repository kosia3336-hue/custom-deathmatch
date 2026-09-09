import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ABSTRACT_AI_THINK_SECONDS,
  GAME_IDS,
  MAX_ABSTRACT_AI_THINK_SECONDS,
  MIN_ABSTRACT_AI_THINK_SECONDS,
  formatAbstractAiThinkSeconds,
  isAbstractStrategyGameId,
  resolveAbstractAiThinkSeconds,
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

describe('추상전략 AI 고민 시간 계약', () => {
  it('사중력과 양면장기만 추상전략 고민 시간 대상으로 분류한다', () => {
    expect(isAbstractStrategyGameId(GAME_IDS.FOUR_GRAVITY)).toBe(true);
    expect(isAbstractStrategyGameId(GAME_IDS.DOUBLE_SIDED_CHESS)).toBe(true);
    expect(isAbstractStrategyGameId(GAME_IDS.BANK_GAME)).toBe(false);
  });

  it('5초를 기본값으로 쓰고 5초~3분으로 자른다', () => {
    expect(DEFAULT_ABSTRACT_AI_THINK_SECONDS).toBe(5);
    expect(MIN_ABSTRACT_AI_THINK_SECONDS).toBe(5);
    expect(MAX_ABSTRACT_AI_THINK_SECONDS).toBe(180);
    expect(resolveAbstractAiThinkSeconds(undefined)).toBe(5);
    expect(resolveAbstractAiThinkSeconds({})).toBe(5);
    expect(resolveAbstractAiThinkSeconds({ aiThinkSeconds: 3 })).toBe(5);
    expect(resolveAbstractAiThinkSeconds({ aiThinkSeconds: 60 })).toBe(60);
    expect(resolveAbstractAiThinkSeconds({ aiThinkSeconds: 200 })).toBe(180);
    expect(resolveAbstractAiThinkSeconds({ aiDifficulty: 'hard' })).toBe(30);
    expect(resolveAbstractAiThinkSeconds({ aiThinkSeconds: 15, aiDifficulty: 'hard' })).toBe(15);
  });

  it('초를 분·초 문구로 표시한다', () => {
    expect(formatAbstractAiThinkSeconds(5)).toBe('5초');
    expect(formatAbstractAiThinkSeconds(60)).toBe('1분');
    expect(formatAbstractAiThinkSeconds(90)).toBe('1분 30초');
    expect(formatAbstractAiThinkSeconds(180)).toBe('3분');
  });

  it('사중력 COM 상태에 선택한 고민 시간을 저장한다', () => {
    const defaultRoomId = 'four-gravity-default-ai';
    const longRoomId = 'four-gravity-long-ai';
    roomIds.add(defaultRoomId);
    roomIds.add(longRoomId);
    const players = [player('human-four', '사람'), player(AI_PLAYER_ID, 'AI')];

    initFourGravity(ioStub(), defaultRoomId, players, 'com', Date.now(), null, vi.fn());
    initFourGravity(ioStub(), longRoomId, players, 'com', Date.now(), null, vi.fn(), {
      aiThinkSeconds: 180,
    });

    expect(fourGravityStates.get(defaultRoomId)?.aiThinkSeconds).toBe(5);
    expect(fourGravityStates.get(longRoomId)?.aiThinkSeconds).toBe(180);
  });

  it('양면장기 COM 상태에 선택한 고민 시간을 저장한다', () => {
    const roomId = 'double-sided-chess-think-ai';
    roomIds.add(roomId);
    const players = [player('human-chess', '사람'), player(AI_PLAYER_ID, 'AI')];

    initDoubleSidedChess(ioStub(), roomId, players, 'com', Date.now(), null, vi.fn(), {
      aiThinkSeconds: 30,
    });

    expect(doubleSidedChessStates.get(roomId)?.aiThinkSeconds).toBe(30);
  });
});
