'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import Button from '@/components/ui/Button';
import RoomChat from '@/components/room/RoomChat';
import { formatTime } from '@/lib/utils';

const PODIUM_COLORS = ['bg-indigo-600', 'bg-indigo-400', 'bg-indigo-300'] as const;
const PODIUM_HEIGHTS = ['h-28', 'h-20', 'h-16'] as const;
const MEDALS = ['🥇', '🥈', '🥉'] as const;

const AUTO_LEAVE_SEC = 120;

export default function ResultScreen() {
  const router = useRouter();
  const gameResult = useRoomStore((s) => s.gameResult);
  const room = useRoomStore((s) => s.room);
  const { setHeaderRight, setFooter } = useRoomLayout();
  const [timer, setTimer] = useState(AUTO_LEAVE_SEC);
  const cancelledRef = useRef(false);

  const handleLobby = useCallback(() => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/');
  }, [router]);

  const handleSaveRecord = useCallback(() => {
    const { gameResult: gr, room: rm } = useRoomStore.getState();
    if (!gr || !rm) return;

    const grd = gr.gameResultData as Record<string, unknown> | undefined;
    if (!grd?.actions) {
      toast.error('기록 데이터가 없습니다.');
      return;
    }

    const record = {
      version: '1.0',
      gameId: rm.gameId,
      gameName: rm.gameName,
      playedAt: new Date().toISOString(),
      playMode: rm.playMode,
      players: (grd.players as Record<string, { nickname: string }>) ?? {},
      result: {
        rankings: gr.rankings.map((r) => ({
          nickname: r.nickname,
          rank: r.rank,
          score: r.score,
        })),
        playTime: gr.playTime,
        totalTurns: gr.totalTurns,
      },
      gameRecord: {
        winType: (grd.winType as string) ?? null,
        winLine: grd.winLine ?? null,
        actions: grd.actions ?? [],
      },
    };

    const json = JSON.stringify(record, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const gameName = rm.gameName.replace(/\s+/g, '');

    const a = document.createElement('a');
    a.href = url;
    a.download = `${gameName}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('기록이 저장되었습니다.');
  }, []);

  const handleRematch = useCallback(() => {
    cancelledRef.current = true;
    getSocket().emit('game:rematch');
    useRoomStore.getState().setGameResult(null);
    if (room?.playMode === 'multi') {
      router.push(`/room/${room.id}`);
    } else {
      router.push(`/room/${room?.id}/play`);
    }
  }, [room, router]);

  useEffect(() => {
    if (cancelledRef.current || timer <= 0) {
      if (timer <= 0 && !cancelledRef.current) handleLobby();
      return;
    }
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer, handleLobby]);

  /* ── 헤더 오른쪽 슬롯 ── */
  useEffect(() => {
    setHeaderRight(
      <Button variant="ghost" size="sm" onClick={handleLobby}>
        로비로
      </Button>,
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, handleLobby]);

  /* ── 푸터 슬롯 ── */
  useEffect(() => {
    setFooter(
      <>
        {!cancelledRef.current && timer > 0 && (
          <span className="mr-auto text-xs text-gray-400">
            {timer}초 후 자동으로 로비로 이동합니다
          </span>
        )}
        {!!(gameResult?.gameResultData as Record<string, unknown> | undefined)?.actions && (
          <Button variant="ghost" onClick={handleSaveRecord}>기록 저장</Button>
        )}
        <Button onClick={handleRematch}>다시하기</Button>
        <Button variant="secondary" onClick={handleLobby}>로비로</Button>
      </>,
    );
    return () => setFooter(null);
  }, [setFooter, timer, handleRematch, handleLobby]);

  if (!gameResult) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">결과를 불러오는 중...</p>
      </div>
    );
  }

  const sorted = [...gameResult.rankings].sort((a, b) => a.rank - b.rank);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">게임 결과</h1>

      {/* 포디엄 */}
      <div className="mb-8 flex items-end justify-center gap-4">
        {sorted.slice(0, 3).map((p, i) => (
          <div key={p.rank} className="flex flex-col items-center">
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

      {/* 멀티 게임 결과 채팅 */}
      {room?.playMode === 'multi' && (
        <div className="mt-8">
          <RoomChat scope="game" />
        </div>
      )}
    </div>
  );
}
