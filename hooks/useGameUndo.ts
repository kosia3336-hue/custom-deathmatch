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
    /*
      무르기가 서버에서 거절되면(권한 없음, 이미 진행 중 등) 기다림만 푼다.

      토스트는 여기서 띄우지 않는다. 게임 화면은 useRoom 도 함께 쓰는데, 그쪽이
      서버 error 를 이미 토스트로 보여 준다. 여기서도 띄우면 같은 문구가 두 번
      떴다('지금은 무르기를 요청할 수 없습니다' 가 겹쳐 나오던 원인).
    */
    const onError = () => {
      if (undoWaiting) setPending(null);
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
