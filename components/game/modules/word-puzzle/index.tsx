'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import {
  WP_WRONG_LOCK_MS,
  type WordPuzzleGameData,
} from '@/shared/types/word-puzzle';

/** 격자 선택 상태: 각 칸이 어느 슬롯(0~8 순서)에 배정됐는지. -1 = 미사용 */
export default function WordPuzzleGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const gameData = gameState?.gameData as unknown as WordPuzzleGameData | undefined;
  const myId = useMySocketId();

  const [picked, setPicked] = useState<number[]>([]); // grid 인덱스 나열 (최대 9)
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const roundKey = `${gameData?.round}-${gameData?.roundStartedAt}`;
  const prevRoundKey = useRef(roundKey);

  // 라운드 변경 시 선택 초기화
  useEffect(() => {
    if (roundKey !== prevRoundKey.current) {
      prevRoundKey.current = roundKey;
      setPicked([]);
      setLockedUntil(0);
    }
  }, [roundKey]);

  // 남은 시간 표시용 틱
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // 서버 오답 메시지 수신 → 잠금
  useEffect(() => {
    const s = getSocket();
    const onError = (d: { message?: string }) => {
      if (!d?.message) return;
      if (d.message.includes('단어') || d.message.includes('글자')) {
        setLockedUntil(Date.now() + WP_WRONG_LOCK_MS);
      }
    };
    s.on('error', onError);
    return () => {
      s.off('error', onError);
    };
  }, []);

  const words = useMemo(() => {
    if (!gameData) return ['', '', ''];
    const chars = picked.map((i) => gameData.grid[i] ?? '');
    return [0, 1, 2].map((w) => chars.slice(w * 3, w * 3 + 3).join(''));
  }, [picked, gameData]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cdm-fg-muted">게임을 불러오는 중...</p>
      </div>
    );
  }

  const isPlayer = Boolean(myId && gameData.scores[myId] !== undefined);
  const remainSec = Math.max(
    0,
    Math.ceil((gameData.roundStartedAt + gameData.roundSeconds * 1000 - now) / 1000),
  );
  const locked = now < lockedUntil;
  const lockRemain = Math.ceil((lockedUntil - now) / 1000);

  function toggleTile(idx: number) {
    if (!isPlayer || gameData!.phase !== 'playing' || locked) return;
    setPicked((prev) => {
      if (prev.includes(idx)) return prev.filter((x) => x !== idx);
      if (prev.length >= 9) return prev;
      return [...prev, idx];
    });
  }

  function submit() {
    if (picked.length !== 9 || locked) return;
    getSocket().emit('game:action', { type: 'submit', words });
  }

  const scoreEntries = Object.entries(gameData.players).map(([pid, p]) => ({
    pid,
    nickname: p.nickname,
    score: gameData.scores[pid] ?? 0,
    isMe: pid === myId,
  }));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-3 sm:p-4">
      {/* 스코어보드 + 타이머 */}
      <div className="flex items-center justify-between rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2">
        <div className="flex gap-4">
          {scoreEntries.map((e) => (
            <span key={e.pid} className={cn('text-sm', e.isMe ? 'font-bold text-cdm-fg' : 'text-cdm-fg-muted')}>
              {e.nickname} <span className="tabular-nums text-cdm-primary">{e.score}</span>
            </span>
          ))}
        </div>
        <span
          className={cn(
            'text-sm font-bold tabular-nums',
            remainSec <= 10 ? 'text-cdm-accent' : 'text-cdm-fg-muted',
          )}
        >
          R{gameData.round}/{gameData.totalRounds} · {remainSec}s
        </span>
      </div>

      {/* 3×3 격자 */}
      <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-2">
        {gameData.grid.map((ch, i) => {
          const order = picked.indexOf(i);
          const used = order !== -1;
          return (
            <button
              key={i}
              type="button"
              disabled={!isPlayer || gameData.phase !== 'playing' || locked}
              onClick={() => toggleTile(i)}
              className={cn(
                'relative aspect-square rounded-cdm-lg border-2 text-2xl font-extrabold transition-all',
                used
                  ? 'border-cdm-primary bg-cdm-primary text-white'
                  : 'border-cdm-border bg-cdm-bg text-cdm-fg hover:border-cdm-primary hover:-translate-y-0.5',
                (!isPlayer || gameData.phase !== 'playing' || locked) && 'cursor-default opacity-80',
              )}
            >
              {ch}
              {used && (
                <span className="absolute right-1 top-1 rounded-full bg-white/25 px-1 text-[10px] font-bold leading-4">
                  {Math.floor(order / 3) + 1}-{(order % 3) + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 조합 슬롯 */}
      <div className="flex justify-center gap-3">
        {words.map((w, i) => (
          <div
            key={i}
            className={cn(
              'flex h-10 w-20 items-center justify-center rounded-cdm-md border-2 text-base font-bold tracking-widest',
              w.length === 3 ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary' : 'border-dashed border-cdm-border text-cdm-fg-muted',
            )}
          >
            {w.padEnd(3, '·')}
          </div>
        ))}
      </div>

      {/* 액션 */}
      {isPlayer && gameData.phase === 'playing' && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setPicked((p) => p.slice(0, -1))}
            disabled={picked.length === 0 || locked}
            className="rounded-cdm-md border border-cdm-border px-4 py-2 text-sm font-semibold text-cdm-fg hover:bg-cdm-bg-elev-1 disabled:opacity-40"
          >
            한 글자 지우기
          </button>
          <button
            type="button"
            onClick={() => setPicked([])}
            disabled={picked.length === 0 || locked}
            className="rounded-cdm-md border border-cdm-border px-4 py-2 text-sm font-semibold text-cdm-fg hover:bg-cdm-bg-elev-1 disabled:opacity-40"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={picked.length !== 9 || locked}
            className="rounded-cdm-md border border-cdm-primary bg-cdm-primary px-5 py-2 text-sm font-bold text-white hover:bg-cdm-primary-strong disabled:opacity-40"
          >
            {locked ? `오답! ${lockRemain}s` : '제출'}
          </button>
        </div>
      )}

      {/* 안내 */}
      {gameData.phase === 'playing' && (
        <p className="text-center text-[11px] leading-relaxed text-cdm-fg-subtle">
          글자를 순서대로 눌러 3글자 단어 3개를 만드세요. 먼저 맞히는 사람이 라운드 승리!
          <br />
          오답 제출 시 {WP_WRONG_LOCK_MS / 1000}초간 제출이 잠겨요.
        </p>
      )}

      {/* 라운드 결과 */}
      {gameData.phase !== 'playing' && gameData.lastResult && (
        <div className="rounded-cdm-lg border-2 border-cdm-primary bg-cdm-primary-soft/40 p-4 text-center">
          <p className="mb-2 text-sm font-bold text-cdm-fg">
            {gameData.lastResult.winnerId
              ? `${gameData.players[gameData.lastResult.winnerId]?.nickname} 라운드 승리!` +
                (gameData.lastResult.elapsedMs != null
                  ? ` (${(gameData.lastResult.elapsedMs / 1000).toFixed(1)}초)`
                  : '')
              : '시간 초과 — 무승부'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {gameData.lastResult.answerWords.map((w) => (
              <span key={w} className="rounded-cdm-md border border-cdm-primary bg-cdm-bg px-3 py-1 text-base font-bold text-cdm-primary">
                {w}
              </span>
            ))}
          </div>
          {gameData.lastResult.submittedWords &&
            gameData.lastResult.submittedWords.join() !== gameData.lastResult.answerWords.join() && (
              <p className="mt-2 text-xs text-cdm-fg-muted">
                제출 조합: {gameData.lastResult.submittedWords.join(' · ')} (다른 유효 조합)
              </p>
            )}
        </div>
      )}
    </div>
  );
}
