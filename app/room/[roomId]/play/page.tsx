'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import GameShell from '@/components/game/GameShell';
import FourGravityGame from '@/components/game/modules/four-gravity';
import GameModulePlaceholder from '@/components/game/GameModulePlaceholder';
import { useRoom } from '@/hooks/useRoom';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const { gameResult } = useRoom(roomId);
  const gameId = useRoomStore((s) => s.room?.gameId);

  useEffect(() => {
    if (!gameResult) return;
    const timer = setTimeout(() => {
      router.push(`/room/${roomId}/result`);
    }, 3000);
    return () => clearTimeout(timer);
  }, [gameResult, roomId, router]);

  useEffect(() => {
    const socket = getSocket();
    const handleDisbanded = (data: { reason: string }) => {
      toast.info(data.reason);
      useRoomStore.getState().reset();
      router.push('/');
    };
    socket.on('room:disbanded', handleDisbanded);
    return () => { socket.off('room:disbanded', handleDisbanded); };
  }, [router]);

  useEffect(() => {
    getSocket().emit('game:sync');
  }, []);

  return (
    <GameShell>
      {gameId === 'game-001' ? <FourGravityGame /> : <GameModulePlaceholder />}
    </GameShell>
  );
}
