import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ABSTRACT_AI_DIFFICULTY,
  GAME_IDS,
  isAbstractStrategyGameId,
  resolveAbstractAiDifficulty,
  SUPER_AI_GAMES,
  supportsSuperAi,
  supportsSuperAiMatch,
} from '@shared/types/game.js';
import { AI_PLAYER_ID, type Player } from '@shared/types/room.js';
import {
  cleanupFourGravity,
  handleFourGravityToggleAI,
  initFourGravity,
} from '../socket/games/four-gravity/index.js';
import { gameStates as fourGravityStates } from '../socket/games/four-gravity/state.js';
import * as fourGravityState from '../socket/games/four-gravity/state.js';
import {
  cleanupDoubleSidedChess,
  handleDoubleSidedChessToggleAI,
  initDoubleSidedChess,
} from '../socket/games/double-sided-chess/index.js';
import { gameStates as doubleSidedChessStates } from '../socket/games/double-sided-chess/state.js';
import * as doubleSidedChessState from '../socket/games/double-sided-chess/state.js';
import type { IO } from '../socket/types.js';
import type { TypedSocket } from '../socket/games/four-gravity/constants.js';

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
    to: () => ({ emit: () => {} }),
  } as unknown as IO;
}

function socketStub(id: string) {
  return { id } as unknown as TypedSocket;
}

describe('추상전략 AI 난이도 계약', () => {
  it('사중력과 양면장기만 추상전략 난이도 대상으로 분류한다', () => {
    expect(isAbstractStrategyGameId(GAME_IDS.FOUR_GRAVITY)).toBe(true);
    expect(isAbstractStrategyGameId(GAME_IDS.DOUBLE_SIDED_CHESS)).toBe(true);
    expect(isAbstractStrategyGameId(GAME_IDS.BANK_GAME)).toBe(false);
  });

  it('슈퍼 AI 페이지는 사목·양면·넘버4·베팅 가위바위보·배수 흑과 백·연승·흑과백2·실퍼의 흑과백·5개의 탑·포도설탕2·해달별2·은행놀이·콰트로를 올리고, 대국 방은 사목·양면만이다', () => {
    expect(SUPER_AI_GAMES.map((g) => g.id)).toEqual([
      GAME_IDS.FOUR_GRAVITY,
      GAME_IDS.DOUBLE_SIDED_CHESS,
      GAME_IDS.NUMBER_FOUR,
      GAME_IDS.BETTING_RPS,
      GAME_IDS.MULTIPLE_BNW,
      GAME_IDS.WINNING_STREAK,
      GAME_IDS.BNW2,
      GAME_IDS.SILPER_BNW,
      GAME_IDS.FIVE_TOWERS,
      GAME_IDS.GRAPE_SUGAR_2,
      GAME_IDS.SUN_MOON_STAR_2,
      GAME_IDS.BANK_GAME,
      GAME_IDS.QUATRO,
    ]);
    expect(supportsSuperAi(GAME_IDS.FOUR_GRAVITY)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.DOUBLE_SIDED_CHESS)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.NUMBER_FOUR)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.BETTING_RPS)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.MULTIPLE_BNW)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.WINNING_STREAK)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.BNW2)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.SILPER_BNW)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.FIVE_TOWERS)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.GRAPE_SUGAR_2)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.SUN_MOON_STAR_2)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.BANK_GAME)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.QUATRO)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.NUMBER_FOUR)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.BETTING_RPS)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.MULTIPLE_BNW)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.WINNING_STREAK)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.BNW2)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.SILPER_BNW)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.FIVE_TOWERS)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.GRAPE_SUGAR_2)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.SUN_MOON_STAR_2)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.BANK_GAME)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.QUATRO)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.FOUR_GRAVITY)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.KINGMAKING)).toBe(false);
    expect(supportsSuperAi(GAME_IDS.TRIPLE_GOMOKU)).toBe(false);
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
    expect(fourGravityStates.get(hardRoomId)?.superAi).toBe(false);
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

  it('슈퍼 AI 옵션은 COM 난이도와 별도로 저장한다', () => {
    const roomId = 'four-gravity-super-ai';
    roomIds.add(roomId);
    const players = [player('human-four', '사람'), player(AI_PLAYER_ID, 'AI')];

    initFourGravity(ioStub(), roomId, players, 'com', Date.now(), null, vi.fn(), {
      superAi: true,
    });

    expect(fourGravityStates.get(roomId)?.superAi).toBe(true);
    expect(fourGravityStates.get(roomId)?.aiDifficulty).toBe('normal');
  });

  it('슈퍼 AI 솔로는 닉네임과 무관하게 토글용 ownerToken을 둔다', () => {
    const fgRoomId = 'four-gravity-super-solo';
    const dscRoomId = 'double-sided-chess-super-solo';
    roomIds.add(fgRoomId);
    roomIds.add(dscRoomId);
    const host = player('human-four', '사람');

    initFourGravity(ioStub(), fgRoomId, [host], 'solo', Date.now(), null, vi.fn(), {
      superAi: true,
    });
    initDoubleSidedChess(ioStub(), dscRoomId, [host], 'solo', Date.now(), null, vi.fn(), {
      superAi: true,
    });

    expect(fourGravityStates.get(fgRoomId)?.ownerToken).toBe('human-four');
    expect(fourGravityStates.get(fgRoomId)?.superAi).toBe(true);
    expect(doubleSidedChessStates.get(dscRoomId)?.ownerToken).toBe('human-four');
    expect(doubleSidedChessStates.get(dscRoomId)?.superAi).toBe(true);
  });

  it('슈퍼 AI 토글을 켜면 양측이 AI라서 다음 턴도 AI가 둔다', () => {
    vi.spyOn(fourGravityState, 'runAITurn').mockResolvedValue(undefined);
    vi.spyOn(doubleSidedChessState, 'runAITurn').mockResolvedValue(undefined);

    const fgRoomId = 'four-gravity-super-both';
    const dscRoomId = 'double-sided-chess-super-both';
    roomIds.add(fgRoomId);
    roomIds.add(dscRoomId);
    const host = player('human-four', '사람');
    const io = ioStub();
    const sock = socketStub('human-four');

    initFourGravity(io, fgRoomId, [host], 'solo', Date.now(), null, vi.fn(), { superAi: true });
    initDoubleSidedChess(io, dscRoomId, [host], 'solo', Date.now(), null, vi.fn(), { superAi: true });

    handleFourGravityToggleAI(io, sock, fgRoomId, { ai: true });
    handleDoubleSidedChessToggleAI(io, sock, dscRoomId, { ai: true });

    const fg = fourGravityStates.get(fgRoomId)!;
    const dsc = doubleSidedChessStates.get(dscRoomId)!;
    expect(fg.blackPlayer.id).toBe(AI_PLAYER_ID);
    expect(fg.whitePlayer.id).toBe(AI_PLAYER_ID);
    expect(dsc.firstPlayer.id).toBe(AI_PLAYER_ID);
    expect(dsc.secondPlayer.id).toBe(AI_PLAYER_ID);

    fg.currentColor = 'white';
    fg.currentPlayer = fg.whitePlayer.id;
    dsc.currentOwner = 'second';
    dsc.currentPlayer = dsc.secondPlayer.id;
    expect(fg.currentPlayer).toBe(AI_PLAYER_ID);
    expect(dsc.currentPlayer).toBe(AI_PLAYER_ID);

    handleFourGravityToggleAI(io, sock, fgRoomId, { ai: false });
    handleDoubleSidedChessToggleAI(io, sock, dscRoomId, { ai: false });
    expect(fourGravityStates.get(fgRoomId)?.blackPlayer.id).toBe('human-four');
    expect(fourGravityStates.get(fgRoomId)?.whitePlayer.id).toBe('human-four');
    expect(doubleSidedChessStates.get(dscRoomId)?.firstPlayer.id).toBe('human-four');
    expect(doubleSidedChessStates.get(dscRoomId)?.secondPlayer.id).toBe('human-four');
  });

  it('천하 솔로 토글은 현재 턴만 AI다', () => {
    vi.spyOn(fourGravityState, 'runAITurn').mockResolvedValue(undefined);
    vi.spyOn(doubleSidedChessState, 'runAITurn').mockResolvedValue(undefined);

    const fgRoomId = 'four-gravity-cheon-one-turn';
    const dscRoomId = 'double-sided-chess-cheon-one-turn';
    roomIds.add(fgRoomId);
    roomIds.add(dscRoomId);
    const host = player('cheon-token', '천하');
    const io = ioStub();
    const sock = socketStub('cheon-token');

    initFourGravity(io, fgRoomId, [host], 'solo', Date.now(), null, vi.fn());
    initDoubleSidedChess(io, dscRoomId, [host], 'solo', Date.now(), null, vi.fn());

    handleFourGravityToggleAI(io, sock, fgRoomId, { ai: true });
    handleDoubleSidedChessToggleAI(io, sock, dscRoomId, { ai: true });

    const fg = fourGravityStates.get(fgRoomId)!;
    const dsc = doubleSidedChessStates.get(dscRoomId)!;
    expect(fg.superAi).toBe(false);
    expect(fg.blackPlayer.id).toBe(AI_PLAYER_ID);
    expect(fg.whitePlayer.id).toBe('cheon-token');
    expect(dsc.firstPlayer.id).toBe(AI_PLAYER_ID);
    expect(dsc.secondPlayer.id).toBe('cheon-token');
  });
});
