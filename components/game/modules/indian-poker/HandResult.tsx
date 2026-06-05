'use client';

import { useState, useEffect } from 'react';
import type { IPShowdownData, IPDieData, IPPlayerInfo, IPWinType } from '@/shared/types/indian-poker';
import type { SkinTheme } from '@/lib/skins/registry';
import { HAND_LABELS, HAND_COLORS, WIN_TYPE_LABELS } from './constants';
import MoonlitCard from './skins/MoonlitCard';

interface HandResultProps {
  showdownData: IPShowdownData | null;
  dieData: IPDieData | null;
  players: Record<string, IPPlayerInfo>;
  winner: string | null;
  winType: IPWinType | null;
  communityCards?: [number, number] | null;
  skin?: SkinTheme | null;
}

function CardChip({
  value,
  label,
  nocturne,
}: {
  value: number;
  label?: string;
  nocturne?: boolean;
}) {
  if (nocturne) {
    return <MoonlitCard value={value} label={label} size="sm" />;
  }
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[10px] text-gray-400">{label}</span>}
      <div className="flex h-12 w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-xl font-bold text-gray-900 shadow-sm">
        {value}
      </div>
    </div>
  );
}

export default function HandResult({
  showdownData, dieData, players, winner, winType, communityCards, skin,
}: HandResultProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 200);
    const t2 = setTimeout(() => setStep(2), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showdownData, dieData]);

  const nocturne = skin === 'nocturne';

  if (showdownData) {
    const entries = Object.entries(showdownData.players);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <div className="text-center text-sm font-semibold text-gray-600">
          {showdownData.isDraw ? '무승부!' : '쇼다운 결과'}
        </div>

        {communityCards && (
          <div className="flex justify-center gap-3">
            <CardChip value={communityCards[0]} label="공유" nocturne={nocturne} />
            <CardChip value={communityCards[1]} label="공유" nocturne={nocturne} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {entries.map(([pid, data], idx) => {
            const p = players[pid];
            const isWinner = pid === showdownData.winnerId;
            const visible = step >= idx + 1;
            const winFx = nocturne && step >= 2 && isWinner && !showdownData.isDraw;
            const loseFx = nocturne && step >= 2 && !isWinner && !showdownData.isDraw;
            return (
              <div
                key={pid}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all duration-500 ${
                  visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                } ${
                  isWinner ? 'border-green-300 bg-green-50' : showdownData.isDraw ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'
                } ${winFx ? 'skin-nocturne-showdown-win' : ''} ${loseFx ? 'skin-nocturne-showdown-lose' : ''}`}
              >
                <span className="text-xs text-gray-500 truncate">{p?.nickname}</span>
                <CardChip value={data.card} nocturne={nocturne} />
                <span className="text-sm font-semibold" style={{ color: HAND_COLORS[data.hand] }}>
                  {HAND_LABELS[data.hand]}
                </span>
                <span className={`text-sm font-bold ${data.chipChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {data.chipChange > 0 ? `+${data.chipChange}` : data.chipChange}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (dieData) {
    const diedP = players[dieData.diedPlayerId];
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="text-center text-sm font-semibold text-red-600">
          {diedP?.nickname} 다이!
        </div>

        <div className="flex justify-center items-end gap-3">
          {communityCards && (
            <>
              <CardChip value={communityCards[0]} label="공유" nocturne={nocturne} />
              <CardChip value={communityCards[1]} label="공유" nocturne={nocturne} />
              <span className="mb-1 text-gray-300 text-lg">+</span>
            </>
          )}
          <CardChip value={dieData.diedCard} label="내 카드" nocturne={nocturne} />
        </div>

        <div className="flex flex-col items-center gap-1 text-sm">
          <span className="font-semibold" style={{ color: HAND_COLORS[dieData.diedHand] }}>
            {HAND_LABELS[dieData.diedHand]}
          </span>
          {dieData.penalty > 0 && (
            <span className="text-red-500 font-medium">패널티: -{dieData.penalty}칩</span>
          )}
        </div>

        <div className="flex justify-center gap-4 text-xs text-gray-500">
          {Object.entries(dieData.chipChanges).map(([pid, change]) => (
            <span key={pid}>
              {players[pid]?.nickname}: <strong className={change >= 0 ? 'text-green-600' : 'text-red-500'}>
                {change > 0 ? `+${change}` : change}
              </strong>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (winner && winType) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
        <div className="text-sm font-semibold text-indigo-700">
          {WIN_TYPE_LABELS[winType]}
        </div>
      </div>
    );
  }

  return null;
}