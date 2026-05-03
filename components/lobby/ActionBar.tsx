'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useLobbyStore } from '@/stores/lobby';
import { useNicknameStore } from '@/stores/nickname';
import { getSocket } from '@/lib/socket';
import { fetchGames } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Game, JoinRoomResult } from '@/shared/types';

interface Props {
  onCreateRoom: () => void;
}

export default function ActionBar({ onCreateRoom }: Props) {
  const router = useRouter();
  const { searchQuery, setSearchQuery, gameFilter, setGameFilter } = useLobbyStore();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const [games, setGames] = useState<Game[]>([]);
  const [quickJoining, setQuickJoining] = useState(false);

  useEffect(() => {
    fetchGames().then(setGames).catch(() => {});
  }, []);

  const handleQuickJoin = () => {
    requireNickname(() => {
      setQuickJoining(true);
      const socket = getSocket();
      socket.emit('room:quickjoin', (res: JoinRoomResult) => {
        setQuickJoining(false);
        if (res.success && res.roomId) {
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
      <div className="flex gap-2">
        <Link
          href="/me?tab=logs"
          className="sm:hidden inline-flex items-center rounded-cdm-md border border-cdm-border bg-cdm-bg px-4 py-2 text-sm font-medium text-cdm-fg hover:bg-cdm-bg-elev-1"
        >
          내 게임 로그
        </Link>
        <Button variant="secondary" onClick={handleQuickJoin} loading={quickJoining}>
          빠른 입장
        </Button>
        <Button onClick={() => requireNickname(onCreateRoom)}>
          방 만들기
        </Button>
      </div>
    </div>
  );
}
