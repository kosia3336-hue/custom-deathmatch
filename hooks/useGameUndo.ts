import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import type { GameUndoProposal, GameTimeExpiry } from '@/shared/types/events';
import type { PlayMode } from '@/shared/types/room';

/** 대기 상태는 요청한 경기 상태에만 묶는다. 게임이 진행되면 파생 값으로 바로 해제된다. */
export function useGameUndo(
  roomId: string | undefined,
  mode: PlayMode | undefined,
  signature: string | null,
) {
  const [undoProposal, setUndoProposal] = useState<GameUndoProposal | null>(null);
  const [pending, setPending] = useState<{
    roomId: string | undefined;
    signature: string | null;
  } | null>(null);
  const undoWaiting =
    pending !== null && pending.roomId === roomId && pending.signature === signature;
  const requestUndo = useCallback(() => {
    if (mode === 'multi') setPending({ roomId, signature });
    getSocket().emit('game:undo:request');
  }, [mode, roomId, signature]);
  useEffect(() => {
    const socket = getSocket();
    const onProposal = (proposal: GameUndoProposal) => setUndoProposal(proposal);
    const onTimeExpiry = (value: GameTimeExpiry | null) => {
      if (!value) return;
      setUndoProposal(null);
      setPending(null);
    };
    const onDeclined = () => {
      setPending(null);
      toast.message('상대가 무르기를 거절했습니다.');
    };
    const onError = (data: { message: string }) => {
      if (undoWaiting) setPending(null);
      if (data?.message) toast.error(data.message);
    };
    socket.on('game:undo:proposal', onProposal);
    socket.on('game:time-expiry', onTimeExpiry);
    socket.on('game:undo:declined', onDeclined);
    socket.on('error', onError);
    return () => {
      socket.off('game:undo:proposal', onProposal);
      socket.off('game:time-expiry', onTimeExpiry);
      socket.off('game:undo:declined', onDeclined);
      socket.off('error', onError);
    };
  }, [undoWaiting]);
  return { undoProposal, setUndoProposal, undoWaiting, requestUndo };
}
