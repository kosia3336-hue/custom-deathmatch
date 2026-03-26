'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import Button from '@/components/ui/Button';
import RoomChat from '@/components/room/RoomChat';
import { formatTime } from '@/lib/utils';

const PODIUM_COLORS = ['bg-indigo-600', 'bg-indigo-400', 'bg-indigo-300'] as const;
const PODIUM_HEIGHTS = ['h-28', 'h-20', 'h-16'] as const;
const MEDALS = ['🥇', '🥈', '🥉'] as const;

export default function ResultScreen() {
  const router = useRouter();
  const gameResult = useRoomStore((s) => s.gameResult);
  const room = useRoomStore((s) => s.room);
  const [timer, setTimer] = useState(120);

  const handleLobby = useCallback(() => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/');
  }, [router]);

  useEffect(() => {
    if (timer <= 0) {
      handleLobby();
      return;
    }
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer, handleLobby]);

  const handleRematch = () => {
    setTimer(0);
    getSocket().emit('game:rematch');
    if (room?.playMode === 'multi') {
      router.push(`/room/${room.id}`);
    } else {
      router.push(`/room/${room?.id}/play`);
    }
  };

  if (!gameResult) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">결과를 불러오는 중...</p>
      </div>
    );
  }

  const sorted = [...gameResult.rankings].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto w-full max-w-2xl flex-1 p-6">
        <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">게임 결과</h1>

        {/* 포디엄 */}
        <div className="mb-8 flex items-end justify-center gap-4">
          {sorted.slice(0, 3).map((p, i) => (
            <div key={p.playerId} className="flex flex-col items-center">
              <span className="text-2xl">{MEDALS[i]}</span>
              <span className="mt-1 text-sm font-bold text-gray-900">{p.nickname}</span>
              <span className="text-xs text-gray-500">{p.score}점</span>
              <div className={`mt-2 w-20 rounded-t-lg ${PODIUM_COLORS[i]} ${PODIUM_HEIGHTS[i]}`} />
            </div>
          ))}
        </div>

        {/* 요약 */}
        <div className="mb-6 flex justify-center gap-8 text-sm text-gray-500">
          <span>플레이 시간: {formatTime(gameResult.playTime)}</span>
          <span>총 턴 수: {gameResult.totalTurns}턴</span>
        </div>

        {/* 자동 이동 타이머 */}
        <p className="mb-6 text-center text-xs text-gray-400">
          {timer}초 후 자동으로 로비로 이동합니다
        </p>

        {/* 액션 버튼 */}
        <div className="flex justify-center gap-4">
          <Button onClick={handleRematch}>다시하기</Button>
          <Button variant="secondary" onClick={handleLobby}>로비로</Button>
        </div>

        {/* 결과 채팅 */}
        {room?.playMode === 'multi' && (
          <div className="mt-8">
            <RoomChat scope="game" />
          </div>
        )}
      </div>
    </div>
  );
}
