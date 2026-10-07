'use client';
import type { SeedSeotdaGameData } from '@/shared/types/seed-seotda';

export function ResultOverlay({ gameData }: { gameData: SeedSeotdaGameData }) {
  const result = gameData.lastRoundResult;
  if (gameData.phase !== 'round-result' || !result) return null;
  const winnerName = result.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  /* 다이는 이긴 사람이 아니라 던진 사람을 부른다 — 인디언홀덤Q·양면포커와 같은 표기다 */
  const foldedName = result.foldedPlayerId
    ? gameData.players[result.foldedPlayerId]?.nickname
    : null;
  const title =
    result.reason === 'tie'
      ? '동일 족보 · 재경기'
      : result.reason === 'gusa-rematch'
        ? '구사 · 재경기'
        : result.reason === 'mung-gusa-rematch'
          ? '멍텅구리 구사 · 재경기'
          : result.reason === 'die'
            ? `${foldedName ?? '상대'}님 다이`
            : `${winnerName ?? '플레이어'} 님이 ${result.potAmount}칩 획득`;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="border-cdm-highlight bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
        <p className="text-cdm-fg text-base font-black">{title}</p>
        {result.diePenalty > 0 && (
          <p className="text-cdm-accent mt-1 text-xs font-black">
            더 높은 패로 다이하여 추가 {result.diePenalty}칩 패널티
          </p>
        )}
        {['tie', 'gusa-rematch', 'mung-gusa-rematch'].includes(result.reason) && (
          <p className="text-cdm-fg-muted mt-1 text-[11px]">
            팟과 선 플레이어를 유지하고 새 패로 이어서 진행합니다.
          </p>
        )}
      </div>
    </div>
  );
}
