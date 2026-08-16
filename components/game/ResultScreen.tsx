'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import Button from '@/components/ui/Button';
import RoomChat from '@/components/room/RoomChat';
import { ReportModal } from '@/components/cdm/ReportModal';
import { formatTime, formatTimeLimit } from '@/lib/utils';
import { useSaveRecord } from '@/hooks/useSaveRecord';
import { GAME_IDS } from '@/shared/types';
import { WIN_TYPE_LABEL as FG_WIN_TYPE_LABEL } from '@/components/game/modules/four-gravity/constants';
import { WIN_TYPE_LABEL as DSC_WIN_TYPE_LABEL } from '@/components/game/modules/double-sided-chess/constants';
import { WIN_TYPE_LABELS as NF4_WIN_TYPE_LABELS } from '@/components/game/modules/number4/constants';
import { WIN_TYPE_LABELS as IP_WIN_TYPE_LABELS } from '@/components/game/modules/indian-poker/constants';
import { WIN_TYPE_LABELS as WS_WIN_TYPE_LABELS } from '@/components/game/modules/winning-streak/constants';

const PODIUM_COLORS = ['bg-cdm-primary', 'bg-cdm-primary/70', 'bg-cdm-primary/50'] as const;
const PODIUM_HEIGHTS = ['h-28', 'h-20', 'h-16'] as const;
const MEDALS = ['', '', ''] as const;

const AUTO_LEAVE_SEC = 120;

export default function ResultScreen() {
  const router = useRouter();
  const gameResult = useRoomStore((s) => s.gameResult);
  const room = useRoomStore((s) => s.room);
  const { setHeaderRight, setFooter } = useRoomLayout();
  const [timer, setTimer] = useState(AUTO_LEAVE_SEC);
  const [cancelled, setCancelled] = useState(false);
  const myNickname = useNicknameStore((s) => s.nickname);
  const [reportTarget, setReportTarget] = useState<{ memberId: string; nickname: string } | null>(null);

  const handleSaveRecord = useSaveRecord();

  const handleLobby = useCallback(() => {
    getSocket().emit('game:leave');
    useRoomStore.getState().reset();
    router.push('/lobby');
  }, [router]);

  const handleRematch = useCallback(() => {
    if (!room) return;
    setCancelled(true);
    getSocket().emit('game:rematch');
    useRoomStore.getState().setGameResult(null);
    if (room.playMode === 'multi') {
      router.push(`/room/${room.id}`);
    } else {
      router.push(`/room/${room.id}/play`);
    }
  }, [room, router]);

  useEffect(() => {
    if (cancelled) return;
    const id = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cancelled]);

  useEffect(() => {
    if (!cancelled && timer === 0) {
      handleLobby();
    }
  }, [timer, cancelled, handleLobby]);

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
    const _grd = gameResult?.gameResultData as Record<string, unknown> | undefined;
    const hasRecord = !!(_grd?.actions || _grd?.roundHistory || _grd?.stages || _grd?.rounds);
    setFooter(
      <>
        {!cancelled && timer > 0 && (
          <span className="mr-auto text-xs text-cdm-fg-subtle">
            {timer}초 후 자동으로 로비로 이동합니다
          </span>
        )}
        {hasRecord && (
          <Button variant="ghost" onClick={handleSaveRecord}>기록 저장</Button>
        )}
        <Button onClick={handleRematch}>다시하기</Button>
        <Button variant="secondary" onClick={handleLobby}>로비로</Button>
      </>,
    );
    return () => setFooter(null);
  }, [setFooter, timer, cancelled, gameResult, handleSaveRecord, handleRematch, handleLobby]);

  if (!gameResult) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cdm-fg-muted">결과를 불러오는 중...</p>
      </div>
    );
  }

  const grd = gameResult.gameResultData as Record<string, unknown> | undefined;
  const winType = grd?.winType as string | undefined;
  const winLabelMap = room?.gameId === GAME_IDS.DOUBLE_SIDED_CHESS
    ? DSC_WIN_TYPE_LABEL
    : room?.gameId === GAME_IDS.NUMBER_FOUR
      ? NF4_WIN_TYPE_LABELS
      : room?.gameId === GAME_IDS.INDIAN_POKER
        ? IP_WIN_TYPE_LABELS
        : room?.gameId === GAME_IDS.WINNING_STREAK
          ? WS_WIN_TYPE_LABELS
          : FG_WIN_TYPE_LABEL;
  const winTypeLabel = winType ? ((winLabelMap as Record<string, string>)[winType] ?? null) : null;

  const sorted = [...gameResult.rankings].sort((a, b) => a.rank - b.rank);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="mb-8 text-center text-2xl font-bold text-cdm-fg">게임 결과</h1>

      {/* 포디엄 */}
      <div className="mb-8 flex items-end justify-center gap-4">
        {sorted.slice(0, 3).map((p, i) => (
          <div key={p.rank} className="flex flex-col items-center">
            <span className="text-2xl">{MEDALS[i]}</span>
            <span className="mt-1 text-sm font-bold text-cdm-fg">{p.nickname}</span>
            <span className="text-xs text-cdm-fg-muted">{p.score}점</span>
            {p.memberId && p.nickname !== myNickname && (
              <button
                type="button"
                onClick={() => setReportTarget({ memberId: p.memberId!, nickname: p.nickname })}
                className="mt-1 text-xs text-cdm-fg-subtle hover:text-cdm-danger"
              >
                신고
              </button>
            )}
            <div className={`mt-2 w-20 rounded-t-cdm-md ${PODIUM_COLORS[i]} ${PODIUM_HEIGHTS[i]}`} />
          </div>
        ))}
      </div>

      {/* 요약 */}
      <div className="mb-6 flex flex-wrap justify-center gap-x-8 gap-y-1 text-sm text-cdm-fg-muted">
        <span>플레이 시간: {formatTime(gameResult.playTime)}</span>
        <span>총 턴 수: {gameResult.totalTurns}턴</span>
        {winTypeLabel && <span>승리 방식: {winTypeLabel}</span>}
        {room?.timeLimitSeconds != null && (
          <span>시간제한: {formatTimeLimit(room.timeLimitSeconds)}</span>
        )}
      </div>

      {/* 멀티 게임 결과 채팅 */}
      {room?.playMode === 'multi' && (
        <div className="mt-8">
          <RoomChat scope="room" />
        </div>
      )}

      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.memberId ?? null}
        targetNickname={reportTarget?.nickname}
        context="postgame"
        contextData={{ roomId: room?.id }}
      />
    </div>
  );
}
