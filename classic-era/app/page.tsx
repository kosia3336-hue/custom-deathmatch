'use client';

import { useState } from 'react';
import GNB from '@/classic-era/components/layout/GNB';
import ActionBar from '@/classic-era/components/lobby/ActionBar';
import TabFilter from '@/classic-era/components/lobby/TabFilter';
import RoomTable from '@/classic-era/components/lobby/RoomTable';
import RoomCardList from '@/classic-era/components/lobby/RoomCard';
import EmptyState from '@/classic-era/components/lobby/EmptyState';
import CreateRoomModal from '@/classic-era/components/lobby/CreateRoomModal';
import PasswordModal from '@/classic-era/components/lobby/PasswordModal';
import { useLobby } from '@/classic-era/hooks/useLobby';
import type { RoomSummary } from '@/classic-era/shared/types';

export default function LobbyPage() {
  const lobby = useLobby();

  const [showCreate, setShowCreate] = useState(false);
  const [passwordRoom, setPasswordRoom] = useState<RoomSummary | null>(null);
  const [spectatePasswordRoom, setSpectatePasswordRoom] = useState<RoomSummary | null>(null);

  const filteredRooms = lobby.getFilteredRooms();
  const hasFilter = lobby.searchQuery !== '' || lobby.gameFilter !== 'all' || lobby.tabFilter !== 'all';

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
              <RoomTable
                rooms={filteredRooms}
                onJoin={(room) => lobby.joinRoom(room, () => setPasswordRoom(room))}
                onSpectate={(room) => lobby.spectateRoom(room, () => setSpectatePasswordRoom(room))}
              />
              <RoomCardList
                rooms={filteredRooms}
                onJoin={(room) => lobby.joinRoom(room, () => setPasswordRoom(room))}
                onSpectate={(room) => lobby.spectateRoom(room, () => setSpectatePasswordRoom(room))}
              />
            </>
          )}
        </div>
      </main>

      <CreateRoomModal open={showCreate} onClose={() => setShowCreate(false)} />
      <PasswordModal open={!!passwordRoom} onClose={() => setPasswordRoom(null)} room={passwordRoom} />
      <PasswordModal open={!!spectatePasswordRoom} onClose={() => setSpectatePasswordRoom(null)} room={spectatePasswordRoom} mode="spectate" />
    </div>
  );
}
