'use client';

import { useState } from 'react';
import ActionBar from '@/components/lobby/ActionBar';
import RoomTable from '@/components/lobby/RoomTable';
import RoomCardList from '@/components/lobby/RoomCard';
import EmptyState from '@/components/lobby/EmptyState';
import CreateRoomModal from '@/components/lobby/CreateRoomModal';
import PasswordModal from '@/components/lobby/PasswordModal';
import { RankAutoRejoinListener } from '@/components/lobby/RankAutoJoinFromQuery';
import { useLobby } from '@/hooks/useLobby';
import { useRankMatchStore } from '@/stores/rankMatch';
import { toast } from 'sonner';
import type { RoomSummary } from '@/shared/types';

export default function LobbyClient() {
  const lobby = useLobby();
  const queuing = useRankMatchStore((s) => s.queuing);

  const [showCreate, setShowCreate] = useState(false);
  const [passwordRoom, setPasswordRoom] = useState<RoomSummary | null>(null);
  const [spectatePasswordRoom, setSpectatePasswordRoom] = useState<RoomSummary | null>(null);

  const filteredRooms = lobby.getFilteredRooms();
  const hasFilter = lobby.searchQuery !== '' || lobby.gameFilters.length > 0 || lobby.tabFilters.length > 0;

  const handleJoin = (room: RoomSummary) => {
    if (queuing) {
      toast.error('랭크 큐 대기 중에는 게임에 참가할 수 없습니다.');
      return;
    }
    lobby.joinRoom(room, () => setPasswordRoom(room));
  };

  return (
    <>
      <RankAutoRejoinListener />
      <div className="space-y-4">
        <ActionBar onCreateRoom={() => setShowCreate(true)} />

        {filteredRooms.length === 0 ? (
          <EmptyState hasFilter={hasFilter} onCreate={() => setShowCreate(true)} />
        ) : (
          <>
            <RoomTable
              rooms={filteredRooms}
              queuing={queuing}
              onJoin={handleJoin}
              onSpectate={(room) => lobby.spectateRoom(room, () => setSpectatePasswordRoom(room))}
            />
            <RoomCardList
              rooms={filteredRooms}
              queuing={queuing}
              onJoin={handleJoin}
              onSpectate={(room) => lobby.spectateRoom(room, () => setSpectatePasswordRoom(room))}
            />
          </>
        )}
      </div>

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} />
      <PasswordModal open={!!passwordRoom} onClose={() => setPasswordRoom(null)} room={passwordRoom} />
      <PasswordModal
        open={!!spectatePasswordRoom}
        onClose={() => setSpectatePasswordRoom(null)}
        room={spectatePasswordRoom}
        mode="spectate"
      />
    </>
  );
}
