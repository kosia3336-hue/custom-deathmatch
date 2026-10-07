'use client';
import type { SBNWPlayerInfo, SBNWRevealData } from '@/shared/types/silper-bnw';
import { TileValueDisplay } from './TileValueDisplay';

export function RevealPanel({
  revealData,
  players,
  myId,
  firstPlayerId,
  step,
  meow,
}: {
  revealData: SBNWRevealData;
  players: Record<string, SBNWPlayerInfo>;
  myId: string;
  firstPlayerId: string;
  step: number;
  meow?: boolean;
}) {
  const firstInfo = players[firstPlayerId];
  const secondId = Object.keys(players).find((id) => id !== firstPlayerId) ?? '';
  const secondInfo = players[secondId];

  const firstWinner = revealData.winnerId === firstPlayerId;
  const secondWinner = revealData.winnerId === secondId;
  const winnerVisible = step >= 3;
  const firstVisible = step >= 1;
  const secondVisible = step >= 2;

  const renderCard = (
    pid: string,
    info: SBNWPlayerInfo | undefined,
    side: SBNWRevealData['first'],
    isWinner: boolean,
    isFirst: boolean,
    visible: boolean,
  ) => {
    const isMe = pid === myId;
    // 서버가 tilesUsed:[] + valueStr:'' 로 보내면 상대 카드 → 마스킹
    const masked = !isMe && side.tilesUsed.length === 0 && side.valueStr === '';
    return (
      <div
        className={`rounded-xl border p-3 text-center transition-all duration-500 ${
          !visible
            ? 'border-gray-200 bg-gray-100 opacity-30'
            : winnerVisible && isWinner
              ? meow
                ? 'skin-meow-reveal-winner border'
                : 'border-emerald-300 bg-emerald-50 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
              : winnerVisible && revealData.winnerId !== null
                ? 'border-gray-200 bg-gray-50 opacity-60'
                : 'border-gray-200 bg-white'
        }`}
      >
        <p className="mb-1 truncate text-xs font-medium text-gray-500">
          {isMe ? '나' : (info?.nickname ?? pid)}
          {isFirst && <span className="ml-1 text-xs text-amber-500">(선)</span>}
        </p>
        <TileValueDisplay
          tiles={side.tilesUsed}
          valueStr={side.valueStr}
          digits={side.digits}
          visible={visible}
          masked={masked}
          meow={meow}
        />
        {winnerVisible && isWinner && (
          <p
            className={`mt-1 text-xs font-bold ${meow ? 'skin-meow-heading' : 'text-emerald-600'}`}
          >
            {meow ? '🐾 +1점' : '+1점'}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className={
        meow
          ? 'skin-meow-reveal-panel space-y-3 p-4'
          : 'space-y-3 rounded-xl border border-gray-200 bg-white p-4'
      }
    >
      <p
        className={`text-center text-sm font-semibold ${meow ? 'skin-meow-panel-title' : 'text-gray-700'}`}
      >
        {meow ? '🐱 라운드 결과' : '라운드 결과'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {renderCard(firstPlayerId, firstInfo, revealData.first, firstWinner, true, firstVisible)}
        {renderCard(secondId, secondInfo, revealData.second, secondWinner, false, secondVisible)}
      </div>
      {winnerVisible && revealData.winnerId === null && (
        <p className="text-center text-sm font-semibold text-amber-500">동률 — 승점 변동 없음</p>
      )}
    </div>
  );
}
