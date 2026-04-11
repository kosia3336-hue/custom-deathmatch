'use client';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { NumberFourGameData } from '@/shared/types/number4';
import TileSelector from './TileSelector';
import NumberSelector from './NumberSelector';
import RevealPanel from './RevealPanel';
import InfoPanel from './InfoPanel';
import PlayerBadge from './PlayerBadge';
import TileTracker from './TileTracker';
import { WIN_TYPE_LABELS } from './constants';

export default function NumberFourGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as NumberFourGameData | undefined;
  const myId = useMySocketId();
  const { remaining: timerRemaining } = useTurnTimer();

  const shownWinnerRef = useRef<string | null>(null);

  useEffect(() => {
    if (!gameData?.winner || !gameData?.winType) return;
    if (shownWinnerRef.current === gameData.winner) return;
    shownWinnerRef.current = gameData.winner;

    const winnerEntry = Object.entries(gameData.players).find(([id]) => id === gameData.winner || id.replace('_p2', '') === gameData.winner);
    const winnerNick = winnerEntry?.[1].nickname ?? '???';
    const reason = gameData.winType ? (WIN_TYPE_LABELS[gameData.winType] ?? '') : '';
    const isMe = gameData.winner === myId;
    const message = `${winnerNick} 승리! ${reason}`;

    if (isMe) toast.success(message, { duration: 5000 });
    else toast.error(message, { duration: 5000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  // 솔로 모드에서 player2는 myId + '_p2' 키를 가지므로 currentSide 기준으로 선택
  const myPlayer = (() => {
    if (gameData.currentSide === 'player2') {
      const p2 = playerEntries.find(([id]) => id === myId + '_p2')?.[1];
      if (p2) return p2;
    }
    return playerEntries.find(([id]) => id === myId)?.[1];
  })();

  const canAct = !isSpectator && gameData.phase !== 'reveal' && gameData.phase !== 'finished';

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* 메인 영역 */}
        <div className="flex flex-1 flex-col items-center gap-2 overflow-y-auto p-2 lg:p-4">
          {/* 모바일: 플레이어 바 */}
          <div className="flex w-full max-w-lg justify-between lg:hidden">
            {playerEntries.map(([id, p]) => (
              <PlayerBadge
                key={id}
                player={p}
                isMe={id === myId || id.replace('_p2', '') === myId}
                timerRemaining={timerRemaining}
              />
            ))}
          </div>

          {/* 상태 메시지 */}
          <div className="text-center text-sm text-gray-500">
            {gameState?.message}
          </div>

          {/* 페이즈별 UI */}
          <div className="w-full max-w-lg flex flex-col gap-3">
            {gameData.phase === 'tileSubmit' && canAct && myPlayer && (
              <TileSelector
                player={myPlayer}
                currentSide={gameData.currentSide}
                isSpectator={isSpectator}
              />
            )}

            {gameData.phase === 'numberSubmit' && canAct && myPlayer && (
              <NumberSelector
                submitted={myPlayer.submitted}
                currentSide={gameData.currentSide}
                isSpectator={isSpectator}
              />
            )}

            {gameData.phase === 'tileSubmit' && (isSpectator || myPlayer?.submitted) && !gameData.currentSide && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-8">
                <div className="animate-pulse text-gray-400">●  ●  ●</div>
                <p className="text-sm text-gray-500">상대의 타일 선택을 기다리는 중...</p>
              </div>
            )}

            {gameData.phase === 'numberSubmit' && (isSpectator || myPlayer?.submitted) && !gameData.currentSide && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-8">
                <div className="animate-pulse text-gray-400">●  ●  ●</div>
                <p className="text-sm text-gray-500">상대의 넘버 선택을 기다리는 중...</p>
              </div>
            )}

            {(gameData.phase === 'reveal' || gameData.phase === 'finished') && gameData.revealData && (
              <RevealPanel
                revealData={gameData.revealData}
                players={gameData.players}
                round={gameData.round}
                winner={gameData.winner}
                winType={gameData.winType}
                tiebreakerReason={gameData.tiebreakerReason}
              />
            )}

            {/* 타일 트래커: 진행 중 페이즈에서만 표시 */}
            {(gameData.phase === 'tileSubmit' || gameData.phase === 'numberSubmit') && (
              isSpectator ? (
                <div className="flex flex-col gap-3">
                  {playerEntries.map(([id, p]) => (
                    <TileTracker key={id} playerNickname={p.nickname} />
                  ))}
                </div>
              ) : (
                <TileTracker />
              )
            )}
          </div>

          {/* 모바일: 라운드 기록 */}
          <div className="w-full max-w-lg lg:hidden">
            {gameData.roundHistory.length > 0 && (
              <details className="rounded-lg border border-gray-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600">
                  라운드 기록 ({gameData.roundHistory.length})
                </summary>
                <div className="border-t border-gray-100 px-3 py-2">
                  <MobileRoundHistory history={gameData.roundHistory} players={gameData.players} />
                </div>
              </details>
            )}
          </div>
        </div>

        {/* 데스크탑: 정보 패널 */}
        <div className="hidden lg:flex lg:w-60 lg:flex-col lg:border-l lg:border-gray-200 lg:p-4">
          <InfoPanel
            round={gameData.round}
            players={gameData.players}
            roundHistory={gameData.roundHistory}
            myId={myId}
          />
        </div>
      </div>
    </div>
  );
}

function MobileRoundHistory({ history, players }: { history: NumberFourGameData['roundHistory']; players: NumberFourGameData['players'] }) {
  const pIds = Object.keys(players);
  return (
    <div className="space-y-1 text-xs">
      {history.map((r) => (
        <div key={r.round} className="flex gap-2">
          <span className="font-medium text-gray-500">R{r.round}</span>
          {pIds.map((pid) => {
            const pr = r.players[pid];
            if (!pr) return null;
            return (
              <span key={pid}>
                N{pr.number} {pr.success ? '✅' : '❌'} {pr.scoreChange > 0 ? `+${pr.scoreChange}` : pr.scoreChange}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
