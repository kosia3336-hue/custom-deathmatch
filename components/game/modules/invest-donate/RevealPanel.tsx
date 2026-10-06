'use client';

import type { InvestDonateGameData } from '@/shared/types/invest-donate';
import { ID_REVEAL_DELAY_MS, ID_WIN_DISPLAY_MS } from '@/shared/types/invest-donate';
import CountdownRing from '@/components/game/CountdownRing';
import { useRevealProgress } from './useRevealProgress';
import { WIN_TYPE_LABELS } from './constants';

function Reveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
    >
      {children}
    </div>
  );
}

export default function RevealPanel({ gameData }: { gameData: InvestDonateGameData }) {
  const {
    revealData,
    players,
    round,
    winner,
    winType,
    rematchReason,
    revealEndsAt,
    finishedEndsAt,
  } = gameData;
  const finished = gameData.phase === 'finished';
  const step = useRevealProgress(revealEndsAt, finished);
  if (!revealData)
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
        <span>{winType ? WIN_TYPE_LABELS[winType] : '결과를 확인하고 있습니다.'}</span>
        <CountdownRing
          deadline={finishedEndsAt}
          durationMs={ID_WIN_DISPLAY_MS}
          label="게임 결과로 전환 중"
          size={28}
        />
      </div>
    );

  const pIds = Object.keys(revealData.players);

  const totalInvest = pIds.reduce(
    (sum, pid) => sum + (revealData.players[pid]?.investTotal ?? 0),
    0,
  );
  const totalDonate = pIds.reduce(
    (sum, pid) => sum + (revealData.players[pid]?.donateTotal ?? 0),
    0,
  );

  const majorPid = pIds.find((pid) => revealData.players[pid]?.investBadge === 'majorShareholder');
  const majorNick = majorPid ? (players[majorPid]?.nickname ?? '???') : null;

  const miserPids = pIds.filter((pid) => revealData.players[pid]?.donateBadge === 'miser');
  const miserNick = miserPids.length === 1 ? (players[miserPids[0]]?.nickname ?? '???') : null;

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-center text-sm font-bold text-gray-700">{round}라운드 결과</div>

        {/* Step 1: 투자 합계 */}
        <Reveal visible={step >= 1}>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-14 shrink-0 text-xs text-gray-400">투자</span>
            <span className="font-semibold text-blue-600 tabular-nums">{totalInvest}원</span>
          </div>
        </Reveal>

        {/* Step 2: 기부 합계 */}
        <Reveal visible={step >= 2}>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-14 shrink-0 text-xs text-gray-400">기부</span>
            <span className="font-semibold text-emerald-600 tabular-nums">{totalDonate}원</span>
          </div>
        </Reveal>

        {/* Step 3: 대주주 / 수전노 */}
        <Reveal visible={step >= 3}>
          <div className="space-y-1.5 border-t border-gray-100 pt-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-amber-500 bg-transparent" />
              <span className="w-14 shrink-0 text-xs text-gray-400">대주주</span>
              {revealData.investTied ? (
                <span className="text-xs text-gray-400">없음 (공동)</span>
              ) : (
                <span className="font-semibold text-amber-700">{majorNick ?? '???'}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
              <span className="w-14 shrink-0 text-xs text-gray-400">수전노</span>
              {revealData.donateTied ? (
                <span className="font-semibold text-red-600">
                  {miserPids
                    .map((pid) => players[pid]?.nickname)
                    .filter(Boolean)
                    .join(', ')}{' '}
                  <span className="text-xs font-normal text-red-400">(공동)</span>
                </span>
              ) : miserNick ? (
                <span className="font-semibold text-red-600">{miserNick}</span>
              ) : (
                <span className="text-xs text-gray-400">없음</span>
              )}
            </div>
          </div>
        </Reveal>

        {/* Step 4: 플레이어별 점수 변화 */}
        <Reveal visible={step >= 4}>
          <div className="space-y-1.5 border-t border-gray-100 pt-2">
            {pIds.map((pid) => {
              const pr = revealData.players[pid];
              const p = players[pid];
              if (!pr || !p) return null;
              const change = pr.scoreChange;
              return (
                <div key={pid} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{p.nickname}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-500' : 'text-gray-400'}`}
                    >
                      {change > 0 ? `+${change}점` : change < 0 ? `${change}점` : '±0점'}
                    </span>
                    <span className="font-bold text-gray-700 tabular-nums">{p.score}점</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <CountdownRing
          deadline={finished ? finishedEndsAt : revealEndsAt}
          durationMs={finished ? ID_WIN_DISPLAY_MS : ID_REVEAL_DELAY_MS}
          size={28}
          label={finished ? '게임 결과로 전환 중' : '다음 라운드로 전환 중'}
        />
        <span>{finished ? '게임 결과로 전환 중' : '다음 라운드로 전환 중'}</span>
      </div>
      {/* 게임 종료 / 재경기 */}
      <Reveal visible={step >= 4}>
        {winner && winType && (
          <div className="rounded-lg bg-indigo-600 p-3 text-center text-sm font-bold text-white">
            {players[winner]?.nickname ?? '???'} 승리!
            <span className="ml-1 text-xs font-normal opacity-80">
              ({WIN_TYPE_LABELS[winType] ?? winType})
            </span>
          </div>
        )}
        {rematchReason && !winner && (
          <div className="rounded-lg bg-amber-500 p-3 text-center text-sm font-bold text-white">
            재경기! — {rematchReason}
          </div>
        )}
        {winType === 'draw' && (
          <div className="rounded-lg bg-slate-100 p-3 text-center text-sm font-semibold text-gray-700">
            무승부
          </div>
        )}
      </Reveal>
    </div>
  );
}
