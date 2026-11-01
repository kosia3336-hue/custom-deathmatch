'use client';
import { memo } from 'react';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart } from '@/components/game/GameInfoPart';
import { GamePlayerScoreboard } from '@/components/game/GamePlayerScoreboard';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameFeedback } from '@/components/game/GameFeedbackContext';
import { useGameAction } from '@/components/game/GameActionContext';

import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { serverNow } from '@/lib/serverClock';
import { cn } from '@/lib/utils';
import { WP_WRONG_LOCK_MS, type WordPuzzleGameData } from '@/shared/types/word-puzzle';
import { fitBoardWidth } from '@/components/game/GameFrame';

/** 격자 선택 상태: 각 칸이 어느 슬롯(0~8 순서)에 배정됐는지. -1 = 미사용 */
function WordRound({
  gameData,
  myId,
}: GameModuleViewProps<WordPuzzleGameData> & { isSolo?: boolean }) {
  const sendAction = useGameAction();
  const { setHud } = useRoomLayout();
  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: gameData.isSolo
        ? `${gameData.round} / ${gameData.totalRounds}R`
        : `${gameData.round} / ${gameData.totalRounds}R · ${gameData.winScore}승`,
      order:
        gameData.phase === 'playing'
          ? gameData.isSolo
            ? '단어 3개 조합'
            : '(공동 차례) 단어 3개 조합'
          : '결과',
    });
    return () => setHud(null);
  }, [gameData, setHud]);
  const { subscribeError, subscribeWordSearch } = useGameFeedback();

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
  // 남은 시간 표시용 틱
  useEffect(() => {
    // 서버가 준 라운드 시작 시각과 비교하므로 서버 기준 시각으로 센다
    const t = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(t);
  }, []);

  // 서버 오답 메시지 수신 → 잠금
  useEffect(() => {
    const onError = (d: { message?: string }) => {
      if (!d?.message) return;
      if (d.message.includes('단어') || d.message.includes('글자')) {
        setLockedUntil(serverNow() + WP_WRONG_LOCK_MS);
      }
    };
    return subscribeError(onError);
  }, [subscribeError]);

  // '검색 찬스' 조회 결과 수신
  useEffect(() => {
    const onResult = (d: { word: string; exists: boolean }) => {
      setSearchResults((prev) => {
        const next = prev.filter((r) => r.word !== d.word);
        return [{ word: d.word, exists: d.exists }, ...next].slice(0, 8);
      });
    };
    return subscribeWordSearch(onResult);
  }, [subscribeWordSearch]);

  const words = useMemo(() => {
    if (!gameData) return ['', '', ''];
    const chars = picked.map((i) => gameData.grid[i] ?? '');
    return [0, 1, 2].map((w) => chars.slice(w * 3, w * 3 + 3).join(''));
  }, [picked, gameData]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
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
    sendAction({ type: 'submit', words });
  }

  function doSearch() {
    const w = searchInput.replace(/\s/g, '');
    if (!/^[가-힣]{3}$/.test(w)) {
      toast.error('3글자 한글 단어를 입력하세요.', { duration: 1400 });
      return;
    }
    sendAction({ type: 'search', word: w });
    setSearchInput('');
  }

  const scoreEntries = Object.entries(gameData.players)
    .sort(([a], [b]) => Number(b === myId) - Number(a === myId))
    .map(([pid, p]) => ({
      pid,
      nickname: p.nickname,
      score: gameData.scores[pid] ?? 0,
      isMe: pid === myId,
    }));

  return (
    <GameReferenceFrame
      reference={
        <>
          <GameInfoPart title="점수" kind="score" sizeToContent>
            <GamePlayerScoreboard
              myId={myId}
              entries={scoreEntries.map((e) => ({
                id: e.pid,
                nickname: e.nickname,
                value: `${e.score}점`,
              }))}
            />
          </GameInfoPart>
          <GameInfoPart title="라운드 기록">
            {gameData.history.length === 0 ? (
              <p className="text-cdm-fg-muted text-xs">아직 결과가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {[...gameData.history].reverse().map((r) => (
                  <li
                    key={r.round}
                    className="border-cdm-border bg-cdm-bg rounded-lg border p-2 text-xs"
                  >
                    <b>
                      {r.round}R ·{' '}
                      {r.winnerId ? gameData.players[r.winnerId]?.nickname : '시간 초과'}
                    </b>
                    <p className="text-cdm-fg-muted mt-1">{r.answerWords.join(' · ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </GameInfoPart>
        </>
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
                className="rounded-cdm-md border-cdm-border text-cdm-fg hover:bg-cdm-bg-elev-1 border px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                한 글자 지우기
              </button>
              <button
                type="button"
                onClick={() => setPicked([])}
                disabled={picked.length === 0 || locked}
                className="rounded-cdm-md border-cdm-border text-cdm-fg hover:bg-cdm-bg-elev-1 border px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={picked.length !== 9 || locked}
                className="rounded-cdm-md border-cdm-primary bg-cdm-primary hover:bg-cdm-primary-strong border px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {locked ? `오답! ${lockRemain}s` : '제출'}
              </button>
            </div>
          )}

          {/* 검색 찬스 — 실제 사전에 있는 단어인지 조회 (아이템 보유자 전용) */}
          {isPlayer && gameData.searchChance && gameData.phase === 'playing' && (
            <div className="rounded-cdm-lg border-cdm-accent/40 bg-cdm-accent/5 border p-3">
              <p className="text-cdm-accent mb-2 flex items-center gap-1 text-xs font-bold">
                <span>🔍 검색 찬스</span>
                <span className="text-cdm-fg-subtle font-normal">
                  — 실제 있는 단어인지 확인 (무제한)
                </span>
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
                  className="rounded-cdm-md border-cdm-border bg-cdm-bg text-cdm-fg focus:border-cdm-accent min-w-0 flex-1 border px-3 py-1.5 text-center text-base font-bold outline-none"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={doSearch}
                  disabled={!searchInput.trim()}
                  className="rounded-cdm-md border-cdm-accent bg-cdm-accent shrink-0 border px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
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
            <div className="rounded-cdm-lg border-cdm-primary bg-cdm-primary-soft/40 border-2 p-4 text-center">
              <p className="text-cdm-fg mb-2 text-sm font-bold">
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
                  <span
                    key={w}
                    className="rounded-cdm-md border-cdm-primary bg-cdm-bg text-cdm-primary border px-3 py-1 text-base font-bold"
                  >
                    {w}
                  </span>
                ))}
              </div>
              {gameData.lastResult.submittedWords &&
                gameData.lastResult.submittedWords.join() !==
                  gameData.lastResult.answerWords.join() && (
                  <p className="text-cdm-fg-muted mt-2 text-xs">
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
        <div
          className="mx-auto grid w-full grid-cols-3 gap-2"
          style={{ maxWidth: fitBoardWidth(3, 3, '280px') }}
        >
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
                  'rounded-cdm-lg relative aspect-square border-2 text-2xl font-extrabold transition-all',
                  used
                    ? 'border-cdm-primary bg-cdm-primary text-white'
                    : 'border-cdm-border bg-cdm-bg text-cdm-fg hover:border-cdm-primary hover:-translate-y-0.5',
                  (!isPlayer || gameData.phase !== 'playing' || locked) &&
                    'cursor-default opacity-80',
                )}
              >
                {ch}
                {used && (
                  <span className="absolute top-1 right-1 rounded-full bg-white/25 px-1 text-[11px] leading-4 font-bold">
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
                'rounded-cdm-md flex h-10 w-20 items-center justify-center border-2 text-base font-bold tracking-widest',
                w.length === 3
                  ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                  : 'border-cdm-border text-cdm-fg-muted border-dashed',
              )}
            >
              {w.padEnd(3, '·')}
            </div>
          ))}
        </div>
      </div>
    </GameReferenceFrame>
  );
}

function WordPuzzleView(props: GameModuleViewProps<WordPuzzleGameData>) {
  return (
    <WordRound key={`${props.gameData?.round}:${props.gameData?.roundStartedAt}`} {...props} />
  );
}

export default memo(WordPuzzleView);
