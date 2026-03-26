'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GameShell from '@/components/game/GameShell';
import GameModulePlaceholder from '@/components/game/GameModulePlaceholder';
import { useRoom } from '@/hooks/useRoom';
import { getSocket } from '@/lib/socket';

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const { gameResult } = useRoom(roomId);

  useEffect(() => {
    if (gameResult) {
      router.push(`/room/${roomId}/result`);
    }
  }, [gameResult, roomId, router]);

  useEffect(() => {
    const socket = getSocket();
    const handleDisbanded = () => router.push('/');
    socket.on('room:disbanded', handleDisbanded);
    return () => { socket.off('room:disbanded', handleDisbanded); };
  }, [router]);

  return (
    <GameShell roomId={roomId}>
      <GameModulePlaceholder />
    </GameShell>
  );
}
