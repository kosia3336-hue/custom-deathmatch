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
import { GameFrame, fitBoardWidth } from '@/components/game/GameFrame';

/** 격자 선택 상태: 각 칸이 어느 슬롯(0~8 순서)에 배정됐는지. -1 = 미사용 */
export default function WordPuzzleGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const gameData = gameState?.gameData as unknown as WordPuzzleGameData | undefined;
  const myId = useMySocketId();

  const [picked, setPicked] = useState<number[]>([]); // grid 인덱스 나열 (최대 9)
  const [lockedUntil, setLockedUntil] = useState(0);
  /*
    렌더 중 Date.now() 를 읽으면 서버와 클라이언트 값이 갈려 hydration 이 어긋난다.
    서버가 준 라운드 시작 시각으로 초기화하면 양쪽이 같은 값을 그리고, 첫 화면도
    '남은 시간 = 라운드 시간' 이라 맞다. 실제 시각은 아래 interval 이 채운다.
  */
  const [now, setNow] = useState(gameData?.roundStartedAt ?? 0);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<{ word: string; exists: boolean }[]>([]);
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

  // '검색 찬스' 조회 결과 수신
  useEffect(() => {
    const s = getSocket();
    const onResult = (d: { word: string; exists: boolean }) => {
      setSearchResults((prev) => {
        const next = prev.filter((r) => r.word !== d.word);
        return [{ word: d.word, exists: d.exists }, ...next].slice(0, 8);
      });
    };
    s.on('wordpuzzle:searchResult', onResult);
    return () => {
      s.off('wordpuzzle:searchResult', onResult);
    };
  }, []);

  // 라운드가 바뀌면 검색 기록 비우기
  useEffect(() => {
    setSearchResults([]);
    setSearchInput('');
  }, [roundKey]);

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

  function doSearch() {
    const w = searchInput.replace(/\s/g, '');
    if (!/^[가-힣]{3}$/.test(w)) {
      toast.error('3글자 한글 단어를 입력하세요.', { duration: 1400 });
      return;
    }
    getSocket().emit('game:action', { type: 'search', word: w });
    setSearchInput('');
  }

  const scoreEntries = Object.entries(gameData.players).map(([pid, p]) => ({
    pid,
    nickname: p.nickname,
    score: gameData.scores[pid] ?? 0,
    isMe: pid === myId,
  }));

  return (
    <GameFrame
      info={
        <div className="flex flex-col gap-1">
          {/* 스코어보드 + 타이머 */}
          <div className="flex items-center justify-between rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2">
            <div className="flex gap-4">
                  {scoreEntries.map((e) => (
                <span key={e.pid} className={cn('text-sm', e.isMe ? 'font-bold text-cdm-fg' : 'text-cdm-fg-muted')}>
                      {e.nickname} <span className="tabular-nums text-cdm-primary">{e.score}</span>
                </span>
              ))}
            </div>
          </div>

          {/* 안내 */}
              {gameData.phase === 'playing' && (
            <p className="text-center text-[11px] leading-relaxed text-cdm-fg-subtle">
              글자를 순서대로 눌러 3글자 단어 3개를 만드세요.{' '}
                  {gameData.isSolo ? '정답을 맞히면 다음 라운드로!' : '먼저 맞히는 사람이 라운드 승리!'}
              <br />
              오답 제출 시 {WP_WRONG_LOCK_MS / 1000}초간 제출이 잠깁니다.
            </p>
          )}

        </div>
      }
      controls={
        <div className="flex flex-col gap-2">
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

          {/* 검색 찬스 — 실제 사전에 있는 단어인지 조회 (아이템 보유자 전용) */}
              {isPlayer && gameData.searchChance && gameData.phase === 'playing' && (
            <div className="rounded-cdm-lg border border-cdm-accent/40 bg-cdm-accent/5 p-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-bold text-cdm-accent">
                <span>🔍 검색 찬스</span>
                <span className="font-normal text-cdm-fg-subtle">— 실제 있는 단어인지 확인 (무제한)</span>
              </p>
              <div className="flex gap-2">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') doSearch();
                  }}
                  maxLength={3}
                  placeholder="3글자 단어"
                  className="min-w-0 flex-1 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-1.5 text-center text-base font-bold text-cdm-fg outline-none focus:border-cdm-accent"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={doSearch}
                  disabled={!searchInput.trim()}
                  className="shrink-0 rounded-cdm-md border border-cdm-accent bg-cdm-accent px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  검색
                </button>
              </div>
                  {searchResults.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                      {searchResults.map((r) => (
                    <span
                      key={r.word}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-bold',
                        r.exists
                          ? 'bg-cdm-success/15 text-cdm-success'
                          : 'bg-cdm-fg-subtle/15 text-cdm-fg-muted line-through',
                      )}
                    >
                          {r.word} {r.exists ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

              {/* 라운드 결과 */}
              {gameData.phase !== 'playing' && gameData.lastResult && (
            <div className="rounded-cdm-lg border-2 border-cdm-primary bg-cdm-primary-soft/40 p-4 text-center">
              <p className="mb-2 text-sm font-bold text-cdm-fg">
                    {gameData.lastResult.winnerId
                  ? (gameData.isSolo
                      ? '라운드 클리어!'
                      : `${gameData.players[gameData.lastResult.winnerId]?.nickname} 라운드 승리!`) +
                    (gameData.lastResult.elapsedMs != null
                      ? ` (${(gameData.lastResult.elapsedMs / 1000).toFixed(1)}초)`
                      : '')
                  : gameData.isSolo
                    ? '시간 초과!'
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
      }
    >
      <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-3 overflow-hidden">
        {/* 3×3 격자 */}
        <div className="mx-auto grid w-full grid-cols-3 gap-2"
          style={{ maxWidth: fitBoardWidth(3, 3, '280px') }}>
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

      </div>
    </GameFrame>
  );
}
