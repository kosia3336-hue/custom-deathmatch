import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import type { MultipleBnwAction, MultipleBnwGameData } from '@shared/types/multiple-bnw.js';
import type { IO, TypedSocket } from '../socket/games/multiple-bnw/constants.js';
import {
  initMultipleBnw,
  handleMultipleBnwAction,
  cleanupMultipleBnw,
} from '../socket/games/multiple-bnw/index.js';
import { emitStateToSocket, gameStates } from '../socket/games/multiple-bnw/state.js';

describe('배수 흑과백 의심 결과와 획득 점수 기록', () => {
  it.each([
    {
      name: 'suspectFailed',
      mine: 3,
      opponent: 4,
      secondSuspect: false,
      success: false,
      gains: [0, 2],
    },
    {
      name: 'suspectFailNumberWin',
      mine: 5,
      opponent: 3,
      secondSuspect: false,
      success: false,
      gains: [1, 1],
    },
    {
      name: 'suspectSuccess',
      mine: 3,
      opponent: 6,
      secondSuspect: false,
      success: true,
      gains: [1, 0],
    },
    {
      name: 'secondSuspectSuccess',
      mine: 6,
      opponent: 3,
      secondSuspect: true,
      success: null,
      gains: [0, 1],
    },
  ])('$name', ({ name, mine, opponent, secondSuspect, success, gains }) => {
    vi.useFakeTimers();
    const roomId = `record-${name}`;
    const players = ['me', 'opponent'].map(
      (id, i) =>
        ({
          id,
          nickname: i ? '상대 플레이어' : 'MIS2',
          isHost: !i,
          isReady: true,
          joinedAt: Date.now(),
        }) as Player,
    );
    const io = {
      in: () => ({ fetchSockets: async () => [] }),
      to: () => ({ emit: vi.fn() }),
    } as unknown as IO;
    const act = (id: string, action: MultipleBnwAction) =>
      handleMultipleBnwAction(io, { id, emit: vi.fn() } as unknown as TypedSocket, roomId, action);
    try {
      initMultipleBnw(io, roomId, players, 'multi', Date.now(), 60, vi.fn());
      act('me', { type: 'submitTile', tile: mine });
      act('opponent', { type: 'respondTile', tile: opponent });
      act('me', { type: 'suspectFirst', suspect: success !== null });
      if (gameStates.get(roomId)!.phase === 'suspectSecond')
        act('opponent', { type: 'suspectSecond', suspect: secondSuspect });
      const socket = { id: 'me', emit: vi.fn() } as unknown as TypedSocket;
      emitStateToSocket(socket, gameStates.get(roomId)!);
      const data = (socket.emit as ReturnType<typeof vi.fn>).mock.calls.find(
        ([event]) => event === 'game:state',
      )![1].gameData as MultipleBnwGameData;
      expect(data.phase).toBe('result');
      expect(data.roundHistory[0].players.me.suspectSuccess).toBe(success);
      for (const [i, id] of ['me', 'opponent'].entries()) {
        const record = data.roundHistory[0].players[id];
        expect(record.bonusPoint + record.normalPoint).toBe(gains[i]);
        expect(data.resultData!.players[id].totalScoreChange).toBe(gains[i]);
        expect(record.scoreAfter).toBe(data.players[id].score);
        expect(record.scoreAfter).toBe(gains[i]);
      }
      if (process.env.GENERATE_REFACTOR_FIXTURES === '1') {
        const path = new URL(
          '../../../public/dev/refactor-fixtures/multiple-bnw.json',
          import.meta.url,
        );
        const fixtures = JSON.parse(readFileSync(path, 'utf8'));
        fixtures[name] = data;
        writeFileSync(path, JSON.stringify(fixtures, null, 2));
      }
    } finally {
      cleanupMultipleBnw(roomId);
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe('배수 흑과백 라운드 기록의 타일 숫자', () => {
  it('보는 사람 본인이 낸 숫자만 실린다', () => {
    vi.useFakeTimers();
    const roomId = 'record-own-tile';
    const players = ['me', 'opponent'].map(
      (id, i) =>
        ({ id, nickname: id, isHost: !i, isReady: true, joinedAt: Date.now() }) as Player,
    );
    const io = {
      in: () => ({ fetchSockets: async () => [] }),
      to: () => ({ emit: vi.fn() }),
    } as unknown as IO;
    const act = (id: string, action: MultipleBnwAction) =>
      handleMultipleBnwAction(io, { id, emit: vi.fn() } as unknown as TypedSocket, roomId, action);
    const viewAs = (id: string) => {
      const socket = { id, emit: vi.fn() } as unknown as TypedSocket;
      emitStateToSocket(socket, gameStates.get(roomId)!);
      return (socket.emit as ReturnType<typeof vi.fn>).mock.calls.find(
        ([event]) => event === 'game:state',
      )![1].gameData as MultipleBnwGameData;
    };
    try {
      initMultipleBnw(io, roomId, players, 'multi', Date.now(), 60, vi.fn());
      const first = gameStates.get(roomId)!.firstPlayerId;
      const second = first === 'me' ? 'opponent' : 'me';
      act(first, { type: 'submitTile', tile: 5 });
      act(second, { type: 'respondTile', tile: 8 });
      act(first, { type: 'suspectFirst', suspect: false });
      if (gameStates.get(roomId)!.phase === 'suspectSecond')
        act(second, { type: 'suspectSecond', suspect: false });

      const tiles: Record<string, number> = { [first]: 5, [second]: 8 };
      for (const id of ['me', 'opponent']) {
        const other = id === 'me' ? 'opponent' : 'me';
        const record = viewAs(id).roundHistory[0].players;
        expect(record[id].tile).toBe(tiles[id]);
        expect(record[other]).not.toHaveProperty('tile');
      }
      const spectator = viewAs('spectator').roundHistory[0].players;
      expect(spectator.me).not.toHaveProperty('tile');
      expect(spectator.opponent).not.toHaveProperty('tile');
    } finally {
      cleanupMultipleBnw(roomId);
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
