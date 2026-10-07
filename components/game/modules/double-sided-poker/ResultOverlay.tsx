'use client';
import type { DoubleSidedPokerGameData } from '@/shared/types/double-sided-poker';

export function ResultOverlay({ gameData }: { gameData: DoubleSidedPokerGameData }) {
  const result = gameData.lastRoundResult;
  if (gameData.phase !== 'round-result' || !result) return null;
  const winnerName = result.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  /* 다이는 이긴 사람이 아니라 던진 사람을 부른다 — 인디언홀덤Q·시드섯다와 같은 표기다 */
  const foldedName = result.foldedPlayerId
    ? gameData.players[result.foldedPlayerId]?.nickname
    : null;
  const title =
    result.reason === 'tie'
      ? '같은 숫자 · 팟 이월'
      : result.reason === 'fold'
        ? `${foldedName ?? '상대'}님 다이`
        : `${winnerName ?? '플레이어'} 님이 ${result.potAmount}칩 획득`;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="border-cdm-highlight bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
        <p className="text-cdm-fg text-base font-black">{title}</p>
        {result.doubleBonus > 0 && (
          <p className="text-cdm-accent mt-1 text-xs font-black">
            양면베팅 성공 · 상대에게서 추가 {result.doubleBonus}칩 획득
          </p>
        )}
        {result.reason === 'tie' && (
          <p className="text-cdm-fg-muted mt-1 text-[11px]">
            베팅된 칩을 그대로 두고 다음 라운드를 진행합니다.
          </p>
        )}
      </div>
    </div>
  );
}
