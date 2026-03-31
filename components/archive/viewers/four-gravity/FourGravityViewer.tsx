'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameRecordFile, FourGravityRecord } from '@/shared/types/archive';
import type { Direction } from '@/shared/types/four-gravity';
import { computeFrames } from './replayUtils';
import ReplayBoard from './ReplayBoard';
import MoveList from './MoveList';
import { formatTime } from '@/lib/utils';

const DIR_LABEL: Record<Direction, string> = {
  up: '▲ 상',
  down: '▼ 하',
  left: '◀ 좌',
  right: '▶ 우',
  none: '무',
};

const STEP_LABEL: Record<string, string> = {
  start: '시작',
  place: '돌 놓기',
  gravity: '중력',
  neutral: '중립 돌',
};

const WIN_TYPE_LABEL: Record<string, string> = {
  black: '흑 사목 완성',
  white: '백 사목 완성',
  neutral: '중립 돌 사목',
  'no-space': '둘 곳 없음',
  'no-neutral': '중립 돌 놓을 곳 없음',
};

interface Props {
  record: GameRecordFile;
}

export default function FourGravityViewer({ record }: Props) {
  const gameRecord = record.gameRecord as FourGravityRecord;
  const { frames, turnFirstFrame } = useMemo(
    () => computeFrames(gameRecord.actions),
    [gameRecord.actions],
  );
  const totalFrames = frames.length - 1;
  const totalTurns = gameRecord.actions.length;

  // 1번 프레임(첫 돌 놓기)부터 시작
  const [currentFrame, setCurrentFrame] = useState(1);

  const goFirst = useCallback(() => setCurrentFrame(0), []);
  const goPrev = useCallback(() => setCurrentFrame((f) => Math.max(0, f - 1)), []);
  const goNext = useCallback(
    () => setCurrentFrame((f) => Math.min(totalFrames, f + 1)),
    [totalFrames],
  );
  const goLast = useCallback(() => setCurrentFrame(totalFrames), [totalFrames]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'Home') { e.preventDefault(); goFirst(); }
      if (e.key === 'End') { e.preventDefault(); goLast(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goFirst, goPrev, goNext, goLast]);

  const frame = frames[currentFrame];
  const isLastFrame = currentFrame === totalFrames;
  const winLine = isLastFrame ? gameRecord.winLine : null;

  const blackNick = record.players.black?.nickname ?? '흑';
  const whiteNick = record.players.white?.nickname ?? '백';

  const winnerNick = record.result.rankings.find((r) => r.rank === 1)?.nickname;

  const [mobileListOpen, setMobileListOpen] = useState(false);

  /* ── 스와이프 지원 ── */
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goNext();
    else goPrev();
  }, [goNext, goPrev]);

  // 현재 프레임의 단계 레이블
  const stepLabel = (() => {
    if (frame.stepType === 'start') return '시작';
    const base = `턴 ${frame.turnNumber} · ${STEP_LABEL[frame.stepType]}`;
    if (frame.stepType === 'gravity' && frame.gravityDirection) {
      return `${base} ${DIR_LABEL[frame.gravityDirection]}`;
    }
    return base;
  })();

  return (
    <div className="space-y-4">
      {/* Player bar */}
      <div className="flex items-center justify-center gap-8">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full bg-[#1a1a2e]" />
          <span className="text-sm font-bold text-gray-900">{blackNick}</span>
        </div>
        <span className="text-sm text-gray-400">vs</span>
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 rounded-full border border-gray-300 bg-white" />
          <span className="text-sm font-bold text-gray-900">{whiteNick}</span>
        </div>
      </div>

      {/* Main area: board + move list */}
      <div className="flex flex-col lg:flex-row lg:gap-4">
        {/* Board + controls */}
        <div className="flex flex-1 flex-col items-center">
          <div
            className="w-full flex justify-center touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <ReplayBoard
              board={frame.board}
              placedPosition={frame.placedPosition}
              winLine={winLine}
            />
          </div>

          {/* Control bar */}
          <div className="mt-3 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={goFirst}
                disabled={currentFrame === 0}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                ⏮
              </button>
              <button
                onClick={goPrev}
                disabled={currentFrame === 0}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                ◀
              </button>
              <span className="min-w-[56px] text-center text-sm font-medium text-gray-700">
                {frame.stepType === 'start' ? '0' : String(frame.turnNumber)} / {totalTurns}
              </span>
              <button
                onClick={goNext}
                disabled={currentFrame === totalFrames}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                ▶
              </button>
              <button
                onClick={goLast}
                disabled={currentFrame === totalFrames}
                className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                ⏭
              </button>
            </div>
            <span className="text-xs text-gray-500">{stepLabel}</span>
            <span className="text-xs text-gray-400 lg:hidden">← 보드를 스와이프하면 이동 →</span>
          </div>
        </div>

        {/* Desktop: move list sidebar */}
        <div className="hidden lg:block lg:w-56">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
              기보 목록
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <MoveList
                actions={gameRecord.actions}
                currentTurnNumber={frame.turnNumber}
                turnFirstFrame={turnFirstFrame}
                onSelectFrame={setCurrentFrame}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: collapsible move list */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileListOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          기보 목록
          <span className="text-xs text-gray-400">{mobileListOpen ? '접기 ▲' : '펼치기 ▼'}</span>
        </button>
        {mobileListOpen && (
          <div className="mt-1 max-h-[40vh] overflow-y-auto rounded-lg border border-gray-200 bg-white">
            <MoveList
              actions={gameRecord.actions}
              currentTurnNumber={frame.turnNumber}
              turnFirstFrame={turnFirstFrame}
              onSelectFrame={setCurrentFrame}
            />
          </div>
        )}
      </div>

      {/* Game info summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <span>
            <span className="text-gray-400">게임</span>{' '}
            <span className="font-medium text-gray-800">{record.gameName}</span>
          </span>
          <span>
            <span className="text-gray-400">모드</span>{' '}
            <span className="font-medium text-gray-800">
              {record.playMode === 'multi' ? '멀티' : record.playMode === 'com' ? '1:COM' : '1:1 솔로'}
            </span>
          </span>
          <span>
            <span className="text-gray-400">일시</span>{' '}
            <span className="font-medium text-gray-800">
              {new Date(record.playedAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
          <span>
            <span className="text-gray-400">결과</span>{' '}
            <span className="font-medium text-gray-800">
              {winnerNick ? `${winnerNick} 승` : '알 수 없음'}
              {gameRecord.winType ? ` (${WIN_TYPE_LABEL[gameRecord.winType] ?? gameRecord.winType})` : ''}
            </span>
          </span>
          <span>
            <span className="text-gray-400">시간</span>{' '}
            <span className="font-medium text-gray-800">{formatTime(record.result.playTime)}</span>
          </span>
          <span>
            <span className="text-gray-400">턴</span>{' '}
            <span className="font-medium text-gray-800">{record.result.totalTurns}턴</span>
          </span>
        </div>
      </div>
    </div>
  );
}
