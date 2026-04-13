'use client';

import type { IDRevealData, IDPlayerInfo, IDWinType } from '@/shared/types/invest-donate';
import { WIN_TYPE_LABELS } from './constants';

interface Props {
  revealData: IDRevealData;
  players: Record<string, IDPlayerInfo>;
  round: number;
  winner: string | null;
  winType: IDWinType | null;
  rematchReason: string | null;
}

export default function RevealPanel({ revealData, players, round, winner, winType, rematchReason }: Props) {
  const pIds = Object.keys(revealData.players);

  // 투자: 두 플레이어 합산
  const totalInvest = pIds.reduce((sum, pid) => sum + (revealData.players[pid]?.investTotal ?? 0), 0);
  // 기부: 두 플레이어 합산
  const totalDonate = pIds.reduce((sum, pid) => sum + (revealData.players[pid]?.donateTotal ?? 0), 0);

  // 대주주 닉네임
  const majorPid = pIds.find((pid) => revealData.players[pid]?.investBadge === 'majorShareholder');
  const majorNick = majorPid ? (players[majorPid]?.nickname ?? '???') : null;

  // 수전노 닉네임 (donateTied면 여러 명)
  const miserPids = pIds.filter((pid) => revealData.players[pid]?.donateBadge === 'miser');
  const miserNick =
    miserPids.length === 1 ? (players[miserPids[0]]?.nickname ?? '???') : null;

  return (
    <div className="space-y-3">
      {/* Round result card */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-center text-sm font-bold text-gray-700">
          {round}라운드 결과
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 whitespace-nowrap text-xs text-gray-400">투자</span>
            <span className="font-semibold tabular-nums text-blue-600">{totalInvest}원</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 whitespace-nowrap text-xs text-gray-400">기부</span>
            <span className="font-semibold tabular-nums text-emerald-600">{totalDonate}원</span>
          </div>

          <div className="my-2 border-t border-gray-100" />

          {/* 대주주 */}
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-amber-500 bg-transparent" />
            <span className="w-14 shrink-0 whitespace-nowrap text-xs text-gray-400">대주주</span>
            {revealData.investTied ? (
              <span className="text-xs text-gray-400">없음 (공동)</span>
            ) : (
              <span className="font-semibold text-amber-700">{majorNick ?? '???'}</span>
            )}
          </div>

          {/* 수전노 */}
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
            <span className="w-14 shrink-0 whitespace-nowrap text-xs text-gray-400">수전노</span>
            {revealData.donateTied ? (
              <span className="font-semibold text-red-600">
                {miserPids.map((pid) => players[pid]?.nickname).filter(Boolean).join(', ')}{' '}
                <span className="text-xs font-normal text-red-400">(공동)</span>
              </span>
            ) : miserNick ? (
              <span className="font-semibold text-red-600">{miserNick}</span>
            ) : (
              <span className="text-xs text-gray-400">없음</span>
            )}
          </div>
        </div>
      </div>

      {/* Game winner */}
      {winner && winType && (
        <div className="rounded-lg bg-indigo-600 p-3 text-center text-sm font-bold text-white">
          {players[winner]?.nickname ?? '???'} 승리!
          <span className="ml-1 text-xs font-normal opacity-80">
            ({WIN_TYPE_LABELS[winType] ?? winType})
          </span>
        </div>
      )}

      {/* Rematch */}
      {rematchReason && !winner && (
        <div className="rounded-lg bg-amber-500 p-3 text-center text-sm font-bold text-white">
          재경기! — {rematchReason}
        </div>
      )}
    </div>
  );
}
