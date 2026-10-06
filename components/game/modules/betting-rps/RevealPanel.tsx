'use client';
import CountdownRing from '@/components/game/CountdownRing';
import { useDreamshopRevealSound } from './skins/useDreamshopAudio';
import { useRevealProgress } from './useRevealProgress';
import {
  BRPS_REVEAL_DELAY_MS,
  BRPS_WIN_DISPLAY_MS,
  type BettingRpsGameData,
} from '@/shared/types/betting-rps';
import { RESULT_LABELS, RESULT_COLORS, OUTCOME_LABELS, WIN_TYPE_LABELS } from './constants';

export default function RevealPanel({
  gameData,
  dreamshop = false,
}: {
  gameData: BettingRpsGameData;
  dreamshop?: boolean;
}) {
  const { revealData, players, winner, winType } = gameData;
  const finished = gameData.phase === 'finished';
  const step = useRevealProgress(gameData.revealEndsAt, finished);
  const entries = Object.entries(revealData?.players ?? {});
  const bet = entries.find(([, player]) => player.role === 'bet')?.[1];
  const matchResult = entries.find(([, p]) => p.role === 'match')?.[1].matchResult ?? null;
  useDreamshopRevealSound(dreamshop, step, matchResult, bet?.betOutcome ?? null);
  const show = (stage: number) =>
    `transition duration-500 ${step >= stage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`;
  return (
    <div className="space-y-2">
      {revealData && (
        <div data-brps-reveal className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-center text-sm font-bold text-gray-700">
            {gameData.round}라운드 결과
          </div>
          {entries
            .sort(([, a], [, b]) => Number(b.role === 'match') - Number(a.role === 'match'))
            .map(([id, player]) => {
              const match = player.role === 'match';
              const result = match ? player.matchResult : player.prediction;
              return (
                <div key={id} className={show(match ? 1 : 2)}>
                  <div
                    data-brps-reveal-role={player.role ?? undefined}
                    className={`rounded-lg border px-3 py-2 ${match ? 'border-blue-100 bg-blue-50' : 'border-emerald-100 bg-emerald-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-gray-700">
                        {players[id]?.nickname ?? '플레이어'}
                      </span>
                      <span
                        className={`text-lg font-bold ${result ? RESULT_COLORS[result] : 'text-gray-400'}`}
                      >
                        {result ? RESULT_LABELS[result] : '—'}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-1 text-[11px] text-gray-500">
                      <span>{match ? '승부' : `베팅 · ${player.betChips ?? 0}칩`}</span>
                      <span>
                        {match && player.chipChange > 0 ? `+${player.chipChange}칩 · ` : ''}
                        {match ? `${player.chipsBefore}칩 → ${player.chipsAfter}칩` : '예측'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          {bet && (
            <div className={show(3)}>
              <div
                data-brps-outcome={bet.betOutcome ?? undefined}
                className={`rounded-lg px-3 py-2 text-center text-sm font-bold text-white ${bet.betOutcome === 'success' ? 'bg-emerald-600' : bet.betOutcome === 'fail' ? 'bg-red-600' : 'bg-amber-700'}`}
              >
                {bet.betOutcome ? OUTCOME_LABELS[bet.betOutcome] : '—'} ·{' '}
                {bet.chipChange > 0 ? '+' : ''}
                {bet.chipChange}칩 ({bet.chipsBefore} → {bet.chipsAfter})
              </div>
            </div>
          )}
        </div>
      )}
      {finished && (
        <div className="rounded-lg bg-indigo-600 p-2 text-center text-sm font-bold text-white">
          {winner ? `${players[winner]?.nickname ?? '플레이어'} 승리!` : '무승부'}
          {winType && (
            <span className="ml-1 text-[11px] font-normal">
              ({WIN_TYPE_LABELS[winType] ?? winType})
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <CountdownRing
          deadline={finished ? gameData.finishedEndsAt : gameData.revealEndsAt}
          durationMs={finished ? BRPS_WIN_DISPLAY_MS : BRPS_REVEAL_DELAY_MS}
          label={finished ? '게임 결과 표시 중' : '다음 라운드로 이동 중'}
        />
        <span>{finished ? '게임 종료' : '다음 라운드로 이동 중'}</span>
      </div>
    </div>
  );
}
