/**
 * 흑과백2 — 남은 포인트를 올인해도 상대에게 드러나지 않는지.
 *
 * 실제로 났던 버그: 잔여 0 의 표시등 칸수(0)를 그대로 보내, 상대의 '잔여 추리' 범위가
 * 0~0 으로 묶였다. 화면의 표시등은 0 을 1~20 과 같은 한 칸으로 그린다.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import type { BNW2GameData } from '@shared/types/bnw2.js';
import { initBNW2, handleBNW2Action, cleanupBNW2 } from '../socket/games/bnw2/index.js';
import { emitStateToSocket, gameStates } from '../socket/games/bnw2/state.js';
import type { IO, TypedSocket } from '../socket/types.js';

function view(roomId: string, id: string) {
  const socket = { id, emit: vi.fn() } as unknown as TypedSocket & { emit: ReturnType<typeof vi.fn> };
  emitStateToSocket(socket, gameStates.get(roomId)!);
  return socket.emit.mock.calls.find(([e]) => e === 'game:state')![1].gameData as BNW2GameData;
}

describe('흑과백2 올인', () => {
  it('잔여 0 은 상대·관전자에게 1 칸으로 보이고 공개 숫자도 가린다', () => {
    vi.useFakeTimers();
    const roomId = 'bnw2-allin';
    const io = {
      in: () => ({ fetchSockets: async () => [] }),
      to: () => ({ emit: vi.fn() }),
    } as unknown as IO;
    const players = ['a', 'b'].map(
      (id, i) => ({ id, nickname: id, isHost: !i, isReady: true, joinedAt: Date.now() }) as Player,
    );
    try {
      initBNW2(io, roomId, players, 'multi', Date.now(), 60, vi.fn());
      const s = gameStates.get(roomId)!;
      const first = s.firstPlayerId;
      const second = first === 'a' ? 'b' : 'a';
      const all = s.player1.id === first ? s.player1.remainingPoints : s.player2.remainingPoints;
      const act = (id: string, action: Record<string, unknown>) =>
        handleBNW2Action(io, { id, emit: vi.fn() } as unknown as TypedSocket, roomId, action);
      act(first, { type: 'submitFirst', points: all });

      // 후플 차례: 선플의 남은 칸·제시 전 칸
      const opp = view(roomId, second);
      expect(opp.players[first].stage).toBe(1);
      expect(view(roomId, 'spectator').players[first].stage).toBe(1);
      expect(view(roomId, first).players[first].stage).toBe(0);

      act(second, { type: 'submitSecond', points: 5 });
      expect(s.phase).toBe('reveal');
      const reveal = view(roomId, second);
      expect(reveal.revealData!.players[first].stageAfter).toBe(1);
      expect(reveal.revealData!.players[first].points).toBeNull();
      expect(reveal.revealData!.players[second].points).toBe(5);
      expect(reveal.roundHistory[0].players[first].stageAfter).toBe(1);
      expect(view(roomId, first).revealData!.players[first].stageAfter).toBe(0);
    } finally {
      cleanupBNW2(roomId);
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
