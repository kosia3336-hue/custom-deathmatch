'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useGameAction } from '@/components/game/GameActionContext';
import { useGameFeedback } from '@/components/game/GameFeedbackContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { GameScoreLine } from '@/components/game/GameScoreLine';
import GameLoading from '@/components/game/GameLoading';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import { serverNow } from '@/lib/serverClock';
import { cn } from '@/lib/utils';
import { JG_WRONG_LOCK_MS, type JogakGameData } from '@/shared/types/jogak';

/** 조각마다 살짝 기울여 흩어진 느낌만 낸다. 순서는 그대로 읽히게 둔다. */
const TILT = ['-rotate-6', 'rotate-3', '-rotate-2', 'rotate-6', '-rotate-3'];

export default function JogakView({ gameData, myId }: GameModuleViewProps<JogakGameData>) {
  const { setHud } = useRoomLayout();
  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order:
        gameData.phase === 'playing'
          ? gameData.isSolo
            ? '정답 입력'
            : '(공동 차례) 정답 입력'
          : gameData.phase === 'reveal'
            ? '라운드 결과'
            : '결과',
    });
    return () => setHud(null);
  }, [gameData, setHud]);

  // 게임 결과 토스트
  const shownResult = useRef(false);
  useEffect(() => {
    const r = gameData?.result;
    if (!r || shownResult.current) return;
    shownResult.current = true;
    if (gameData.isSolo || !r.winnerId) {
      toast(gameData.isSolo ? r.reason : `무승부! (${r.reason})`, { duration: 6000 });
      return;
    }
    const msg = `${gameData.players[r.winnerId]?.nickname ?? '???'} 승리! ${r.reason}`;
    if (r.winnerId === myId) toast.success(msg, { duration: 6000 });
    else toast.error(msg, { duration: 6000 });
  }, [gameData, myId]);

  if (!gameData) return <GameLoading label="게임을 불러오는 중" />;

  const nick = (id: string | null) => (id ? (gameData.players[id]?.nickname ?? '플레이어') : '');
  const last = gameData.history.at(-1);
  // 정답 공개 중인 라운드 — 라운드가 끝났거나 게임이 끝났을 때 마지막 기록
  const revealed = gameData.phase !== 'playing' && last?.round === gameData.round ? last : null;

  return (
    <GameReferenceFrame
      reference={
        <GameInfoStack>
          <GameInfoPart title="점수" sizeToContent>
            <GameScoreLine
              entries={Object.entries(gameData.players).map(([id, player]) => ({
                label: id === myId ? '나' : player.nickname,
                value: gameData.scores[id] ?? 0,
                isMe: id === myId,
              }))}
              unit="점"
            />
          </GameInfoPart>
          <GameInfoPart title="라운드 기록" preferredBodyHeight={220}>
            {gameData.history.length === 0 ? (
              <p className="text-cdm-fg-muted text-xs">아직 끝난 라운드가 없습니다.</p>
            ) : (
              <ol className="space-y-1.5 text-xs">
                {gameData.history.map((h) => (
                  <li key={h.round} className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-cdm-fg-muted">{h.round}R</span>
                    <span className="text-cdm-fg-muted">{h.category}</span>
                    <span className="tracking-widest">{h.pieces.join('')}</span>
                    <span>→</span>
                    <b className="text-cdm-fg">{h.answer}</b>
                    <span className="text-cdm-fg-muted">
                      ·{' '}
                      {h.winnerId
                        ? gameData.isSolo
                          ? '정답'
                          : `${nick(h.winnerId)} +1점`
                        : '시간 종료'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </GameInfoPart>
        </GameInfoStack>
      }
    >
      <div
        data-game-intrinsic-stage
        className="flex w-full max-w-lg flex-col items-center gap-4 self-center px-2 py-3"
      >
        <span className="text-cdm-fg-muted text-xs font-bold">
          {gameData.isSolo
            ? `${gameData.totalRounds}문제`
            : `${gameData.totalRounds}전 ${gameData.winScore}선승`}
        </span>
        <span className="bg-cdm-primary-soft text-cdm-primary rounded-full px-3 py-1 text-sm font-bold">
          주제 · {gameData.category}
        </span>

        <div
          className="flex flex-wrap justify-center gap-3"
          aria-label={`조각 ${gameData.pieces.join(' ')}`}
        >
          {gameData.pieces.map((p, i) => (
            <span
              key={i}
              className={cn(
                'border-cdm-border bg-cdm-bg text-cdm-fg flex size-14 items-center justify-center rounded-xl border-2 text-3xl font-extrabold shadow-(--cdm-shadow-sm) sm:size-16 sm:text-4xl',
                TILT[i % TILT.length],
              )}
            >
              {p}
            </span>
          ))}
        </div>

        {gameData.phase === 'playing' && gameData.players[myId] && (
          <AnswerInput key={gameData.round} round={gameData.round} />
        )}

        {revealed && (
          <div className="text-center">
            <p className="text-sm">
              정답: <b className="text-cdm-fg text-lg">{revealed.answer}</b>
            </p>
            <p className="text-cdm-fg-muted mt-0.5 text-xs">
              {revealed.winnerId
                ? gameData.isSolo
                  ? '정답!'
                  : `${revealed.winnerId === myId ? '내가' : `${nick(revealed.winnerId)} 님이`} 먼저 맞혔습니다 · +1점`
                : '아무도 맞히지 못했습니다'}
            </p>
          </div>
        )}

        {gameData.phase === 'finished' && gameData.result && (
          <div className="rounded-cdm-lg border-cdm-primary bg-cdm-bg w-full border-2 px-5 py-4 text-center shadow-(--cdm-shadow-lg)">
            <p className="text-cdm-fg text-base font-bold">
              {gameData.isSolo
                ? '게임 종료'
                : gameData.result.winnerId
                  ? `${nick(gameData.result.winnerId)} 승리!`
                  : '무승부'}
            </p>
            <p className="text-cdm-fg-muted mt-1 text-sm">{gameData.result.reason}</p>
          </div>
        )}
      </div>
    </GameReferenceFrame>
  );
}

/** 라운드마다 새로 그린다(key=round) — 지난 라운드 입력이 남지 않게 */
function AnswerInput({ round }: { round: number }) {
  const sendAction = useGameAction();
  const { subscribeError } = useGameFeedback();
  const [word, setWord] = useState('');
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribeError((d: { message?: string }) => {
      if (!d?.message?.includes('땡') && !d?.message?.includes('한글')) return;
      toast.error(d.message, { duration: 1400 });
      setLockedUntil(serverNow() + JG_WRONG_LOCK_MS);
      // 잠금이 풀리면 다시 그려 입력칸을 연다
      setTimeout(() => {
        setTick((t) => t + 1);
        inputRef.current?.focus();
      }, JG_WRONG_LOCK_MS + 50);
    });
  }, [subscribeError]);

  const locked = lockedUntil > 0 && serverNow() < lockedUntil;
  const submit = () => {
    const w = word.replace(/\s/g, '');
    if (!w || locked) return;
    // 입력은 비우지 않는다 — 한글 조합 중 Enter 가 두 번 오면 비운 칸에 마지막 글자가 남는다.
    // 같은 답이 두 번 가도 서버가 오답 잠금·라운드 번호로 걸러 낸다.
    sendAction({ type: 'submit', round, word: w });
  };

  return (
    <div className="flex w-full max-w-xs gap-1.5">
      <input
        ref={inputRef}
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        disabled={locked}
        placeholder={locked ? '잠시 후 다시…' : '정답 입력 후 Enter'}
        className="rounded-cdm-md border-cdm-border bg-cdm-bg text-cdm-fg focus:border-cdm-primary min-w-0 flex-1 border px-2 py-2 text-center text-base font-bold outline-none disabled:opacity-50"
        autoComplete="off"
        autoFocus
      />
      <button
        type="button"
        onClick={submit}
        disabled={locked || !word.trim()}
        className="rounded-cdm-md border-cdm-primary bg-cdm-primary hover:bg-cdm-primary-strong shrink-0 border px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-40"
      >
        제출
      </button>
    </div>
  );
}
