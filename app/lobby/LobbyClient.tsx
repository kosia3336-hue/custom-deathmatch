'use client';

import { useState } from 'react';
import ActionBar from '@/components/lobby/ActionBar';
import MobileHomeHeader from '@/components/lobby/MobileHomeHeader';
import RoomTable from '@/components/lobby/RoomTable';
import RoomCardList from '@/components/lobby/RoomCard';
import EmptyState from '@/components/lobby/EmptyState';
import CreateRoomModal from '@/components/lobby/CreateRoomModal';
import PasswordModal from '@/components/lobby/PasswordModal';
import { RankAutoRejoinListener } from '@/components/lobby/RankAutoJoinFromQuery';
import { useLobby } from '@/hooks/useLobby';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { toast } from 'sonner';
import type { RoomSummary } from '@/shared/types';

export default function LobbyClient() {
  const lobby = useLobby();
  const queuing = useRankMatchStore((s) => s.queuing);
  /*
    출시 전 게임을 어디까지 드러낼지 한 번만 판단해 아래로 내린다.
    ActionBar 는 갈래 필터 목록에서 종목을 빼고, 방 목록은 종목 이름을 가린다.
  */
  const { member } = useCurrentMember();
  const isAdmin = member?.role === 'admin';

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
        {/* 모바일은 앱 재설계안 헤더(랭크 카드 + 행동 줄 + 필터 칩), 데스크톱은 기존 ActionBar */}
        <MobileHomeHeader onCreateRoom={() => setShowCreate(true)} />
        <div className="hidden sm:block">
          <ActionBar onCreateRoom={() => setShowCreate(true)} isAdmin={isAdmin} />
        </div>

        {filteredRooms.length === 0 ? (
          <EmptyState hasFilter={hasFilter} onCreate={() => setShowCreate(true)} />
        ) : (
          <>
            <RoomTable
              rooms={filteredRooms}
              queuing={queuing}
              isAdmin={isAdmin}
              onJoin={handleJoin}
              onSpectate={(room) => lobby.spectateRoom(room, () => setSpectatePasswordRoom(room))}
            />
            <RoomCardList
              rooms={filteredRooms}
              queuing={queuing}
              isAdmin={isAdmin}
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
