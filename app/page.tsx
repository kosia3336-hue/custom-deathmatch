'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import GNB from '@/components/layout/GNB';
import ActionBar from '@/components/lobby/ActionBar';
import TabFilter from '@/components/lobby/TabFilter';
import RoomTable from '@/components/lobby/RoomTable';
import RoomCardList from '@/components/lobby/RoomCard';
import EmptyState from '@/components/lobby/EmptyState';
import CreateRoomModal from '@/components/lobby/CreateRoomModal';
import PasswordModal from '@/components/lobby/PasswordModal';
import { useLobby } from '@/hooks/useLobby';
import { useNicknameStore } from '@/stores/nickname';
import { getSocket } from '@/lib/socket';
import type { RoomSummary } from '@/shared/types';

export default function LobbyPage() {
  const router = useRouter();
  const lobby = useLobby();
  const requireNickname = useNicknameStore((s) => s.requireNickname);

  const [showCreate, setShowCreate] = useState(false);
  const [passwordRoom, setPasswordRoom] = useState<RoomSummary | null>(null);

  const filteredRooms = lobby.getFilteredRooms();
  const hasFilter = lobby.searchQuery !== '' || lobby.gameFilter !== 'all' || lobby.tabFilter !== 'all';

  const handleJoin = (room: RoomSummary) => {
    requireNickname(() => {
      if (room.roomType === 'private') {
        setPasswordRoom(room);
        return;
      }

      const socket = getSocket();
      socket.emit('room:join', { roomId: room.id }, (res) => {
        if (res.success) {
          router.push(`/room/${room.id}`);
        } else {
          toast.error(res.error ?? '입장에 실패했습니다.');
        }
      });
    });
  };

  const handleSpectate = (room: RoomSummary) => {
    requireNickname(() => {
      const socket = getSocket();
      socket.emit('spectate:join', { roomId: room.id }, (res) => {
        if (res.success) {
          router.push(`/room/${room.id}`);
        } else {
          toast.error(res.error ?? '관전에 실패했습니다.');
        }
      });
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <GNB />

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <div className="space-y-4">
          <ActionBar onCreateRoom={() => setShowCreate(true)} />
          <TabFilter />

          {filteredRooms.length === 0 ? (
            <EmptyState hasFilter={hasFilter} onCreate={() => setShowCreate(true)} />
          ) : (
            <>
              <RoomTable rooms={filteredRooms} onJoin={handleJoin} onSpectate={handleSpectate} />
              <RoomCardList rooms={filteredRooms} onJoin={handleJoin} onSpectate={handleSpectate} />
            </>
          )}
        </div>
      </main>

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} />
      <PasswordModal open={!!passwordRoom} onClose={() => setPasswordRoom(null)} room={passwordRoom} />
    </div>
  );
}
