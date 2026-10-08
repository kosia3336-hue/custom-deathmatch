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

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { serverNow } from '@/lib/serverClock';
import { cn } from '@/lib/utils';
import {
  TL_PUZZLE_COUNT,
  TL_WRONG_LOCK_MS,
  type TransletterGameData,
} from '@/shared/types/transletter';

function TransletterView({
  gameData,
  myId,
}: GameModuleViewProps<TransletterGameData> & { isSolo?: boolean }) {
  const sendAction = useGameAction();
  const { setHud } = useRoomLayout();
  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: '3문제',
      order:
        gameData.phase === 'playing'
          ? gameData.isSolo
            ? '정답 입력'
            : '(공동 차례) 정답 입력'
          : '결과',
    });
    return () => setHud(null);
  }, [gameData, setHud]);
  const { subscribeError } = useGameFeedback();

  const [inputs, setInputs] = useState<string[]>(() => Array(TL_PUZZLE_COUNT).fill(''));
  const [lockedUntil, setLockedUntil] = useState<number[]>(() => Array(TL_PUZZLE_COUNT).fill(0));
  /*
    렌더 중 Date.now() 를 읽으면 서버와 클라이언트 값이 갈려 hydration 이 어긋난다.
    서버가 준 시작 시각으로 초기화하면 양쪽이 같은 값을 그리고, 첫 화면도 '남은 시간
    = 제한 시간' 이라 맞다. 실제 시각은 아래 interval 이 250ms 안에 채운다.
  */
  const [now, setNow] = useState(gameData?.startedAt ?? 0);
  const shownResult = useRef(false);

  useEffect(() => {
    // 서버가 준 시작 시각과 비교하므로 서버 기준 시각으로 센다
    const t = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(t);
  }, []);

  // 오답 → 해당 문제만 짧게 잠금
  const lastErrIndex = useRef(-1);
  useEffect(() => {
    const onError = (d: { message?: string }) => {
      if (d?.message?.includes('땡') || d?.message?.includes('한글')) {
        toast.error(d.message, { duration: 1400 });
        const i = lastErrIndex.current;
        if (i >= 0) {
          setLockedUntil((prev) => {
            const n = [...prev];
            n[i] = serverNow() + TL_WRONG_LOCK_MS;
            return n;
          });
        }
      }
    };
    return subscribeError(onError);
  }, [subscribeError]);

  // 결과 토스트
  useEffect(() => {
    if (!gameData?.result || shownResult.current) return;
    shownResult.current = true;
    const r = gameData.result;
    if (gameData.isSolo) {
      if (r.winnerId) toast.success(r.reason, { duration: 6000 });
      else toast(r.reason, { duration: 6000 });
      return;
    }
    if (!r.winnerId) {
      toast(`무승부! (${r.reason})`, { duration: 6000 });
      return;
    }
    const nick = gameData.players[r.winnerId]?.nickname ?? '???';
    const msg = `${nick} 승리! ${r.reason}`;
    if (r.winnerId === myId) toast.success(msg, { duration: 6000 });
    else toast.error(msg, { duration: 6000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const isPlayer = Boolean(myId && gameData.players[myId]);

  const [aId, bId] = Object.keys(gameData.players);
  const oppId = myId === aId ? bId : aId;

  function submit(i: number) {
    const w = inputs[i].replace(/\s/g, '');
    if (!w || gameData!.mySolved[i] || now < lockedUntil[i]) return;
    lastErrIndex.current = i;
    sendAction({ type: 'submit', index: i, word: w });
  }

  return (
    <GameReferenceFrame
      reference={
        <>
          <GameInfoPart title="점수" kind="score" sizeToContent>
            <GamePlayerScoreboard
              myId={myId}
              entries={[
                {
                  id: myId,
                  nickname: gameData.players[myId]?.nickname ?? '관전',
                  value: `${gameData.myCount}/${TL_PUZZLE_COUNT}`,
                },
                ...(!gameData.isSolo
                  ? [
                      {
                        id: oppId,
                        nickname: gameData.players[oppId]?.nickname ?? '상대',
                        value: `${gameData.oppCount}/${TL_PUZZLE_COUNT}`,
                      },
                    ]
                  : []),
              ]}
            />
          </GameInfoPart>
        </>
      }
    >
      <div data-game-intrinsic-stage className="flex w-full max-w-lg flex-col justify-center gap-2">
        {gameData.puzzles.map((pz, i) => {
          const solved = gameData.mySolved[i];
          const locked = now < lockedUntil[i];
          return (
            <div
              key={i}
              className={cn(
                'rounded-cdm-lg border p-2.5 transition-colors',
                solved ? 'border-cdm-success bg-cdm-success/10' : 'border-cdm-border bg-cdm-bg',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="bg-cdm-primary-soft text-cdm-primary rounded-full px-2 py-0.5 text-[11px] font-bold">
                  {i + 1}. 주제 · {pz.category}
                </span>
                {solved && <span className="text-cdm-success text-[11px] font-bold">✓ 완료</span>}
              </div>
              <p className="text-cdm-fg mb-1.5 text-center text-2xl font-extrabold tracking-wide">
                {pz.transformed}
              </p>
              {gameData.phase === 'playing' && isPlayer && !solved && (
                <div className="flex gap-1.5">
                  <input
                    value={inputs[i]}
                    onChange={(e) =>
                      setInputs((prev) => {
                        const n = [...prev];
                        n[i] = e.target.value;
                        return n;
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submit(i);
                    }}
                    disabled={locked}
                    placeholder={locked ? '잠시 후 다시…' : '정답 입력 후 Enter'}
                    className="rounded-cdm-md border-cdm-border bg-cdm-bg text-cdm-fg focus:border-cdm-primary min-w-0 flex-1 border px-2 py-1.5 text-center text-sm font-bold outline-none disabled:opacity-50"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => submit(i)}
                    disabled={locked || !inputs[i].trim()}
                    className="rounded-cdm-md border-cdm-primary bg-cdm-primary hover:bg-cdm-primary-strong shrink-0 border px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-40"
                  >
                    제출
                  </button>
                </div>
              )}
              {gameData.result && (
                <p className="text-center text-xs">
                  정답: <b className="text-cdm-fg">{gameData.result.answers[i]}</b>
                </p>
              )}
            </div>
          );
        })}

        {gameData.phase === 'finished' && gameData.result && (
          <div className="mt-1 flex justify-center">
            <div className="rounded-cdm-lg border-cdm-primary bg-cdm-bg w-full border-2 px-5 py-4 text-center shadow-(--cdm-shadow-lg)">
              <p className="text-cdm-fg text-base font-bold">
                {gameData.isSolo
                  ? gameData.result.winnerId && gameData.result.reason.includes('모두 완성')
                    ? '클리어!'
                    : '타임 아웃!'
                  : gameData.result.winnerId
                    ? `${gameData.players[gameData.result.winnerId]?.nickname} 승리!`
                    : '무승부'}
              </p>
              <p className="text-cdm-fg-muted mt-1 text-sm">{gameData.result.reason}</p>
            </div>
          </div>
        )}
      </div>
    </GameReferenceFrame>
  );
}

export default memo(TransletterView);
