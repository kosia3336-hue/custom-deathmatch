'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useLobbyStore } from '@/stores/lobby';
import { useNicknameStore } from '@/stores/nickname';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { getSocket } from '@/lib/socket';
import { fetchGames } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GAME_IDS } from '@/shared/types';
import type { Game, JoinRoomResult } from '@/shared/types';
import RankLobbyControls from '@/components/lobby/RankLobbyControls';
import EventLobbyControls from '@/components/lobby/EventLobbyControls';

interface Props {
  onCreateRoom: () => void;
}

export default function ActionBar({ onCreateRoom }: Props) {
  const router = useRouter();
  const { searchQuery, setSearchQuery, gameFilter, setGameFilter } = useLobbyStore();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const queuing = useRankMatchStore((s) => s.queuing);
  const [games, setGames] = useState<Game[]>([]);
  const [quickJoining, setQuickJoining] = useState(false);

  useEffect(() => {
    fetchGames()
      .then((all) =>
        setGames(
          all.filter(
            (g) => g.id !== GAME_IDS.INDIAN_POKER_EVENT && g.id !== GAME_IDS.SUN_MOON_STAR_EVENT,
          ),
        ),
      )
      .catch(() => {});
  }, []);

  const handleQuickJoin = () => {
    if (queuing) {
      toast.error('랭크 큐 대기 중에는 게임에 참가할 수 없습니다.');
      return;
    }
    requireNickname(() => {
      setQuickJoining(true);
      const socket = getSocket();
      socket.emit('room:quickjoin', (res: JoinRoomResult) => {
        setQuickJoining(false);
        if (res.success && res.roomId) {
          useLobbyChatStore.getState().clearAll();
          router.push(`/room/${res.roomId}`);
        } else {
          toast.error(res.error ?? '빠른 입장에 실패했습니다.');
        }
      });
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1 max-w-xs">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="방 제목 검색..."
          />
        </div>
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm text-cdm-fg"
        >
          <option value="all">전체 게임</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <RankLobbyControls />
        <EventLobbyControls />
        <Button variant="secondary" onClick={handleQuickJoin} loading={quickJoining}>
          빠른 입장
        </Button>
        <Button
          onClick={() => {
            if (queuing) {
              toast.error('랭크 큐 대기 중에는 방을 만들 수 없습니다.');
              return;
            }
            requireNickname(onCreateRoom);
          }}
        >
          방 만들기
        </Button>
      </div>
    </div>
  );
}
