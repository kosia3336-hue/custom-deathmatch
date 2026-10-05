'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { IPEGameData, IPEPlayerInfo } from '@/shared/types';
import { sfxCall, sfxRaise, sfxDie } from '@/lib/audio/synth/indian-holdem-event';

interface Props {
  mySeat: IPEPlayerInfo;
  gameData: IPEGameData;
  isMyTurn: boolean;
}

export default function EventBettingPanel({ mySeat, gameData, isMyTurn }: Props) {
  const [showRaise, setShowRaise] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState<number>(gameData.currentBet + 1);

  const minRaise = Math.max(gameData.currentBet + 1, 1);
  const minChipsAlive = Math.min(
    ...gameData.seats.filter((s) => s?.isAlive).map((s) => s!.chips + (s!.roundBet ?? 0)),
    mySeat.roundBet + mySeat.chips,
  );
  const maxRaise = minChipsAlive;
  const callCost = Math.max(0, gameData.currentBet - mySeat.roundBet);
  const canCheck = !gameData.bettingStarted && mySeat.roundBet >= gameData.currentBet;
  const canCall = !canCheck && callCost > 0 && mySeat.chips >= callCost;
  const canRaise = mySeat.chips > callCost && minRaise <= maxRaise;
  const isAllIn = canRaise && maxRaise === mySeat.roundBet + mySeat.chips;

  const safeRaise = Math.max(minRaise, Math.min(maxRaise, raiseAmount));

  const send = (data: Record<string, unknown>) => {
    getSocket().emit('game:action', data);
    setShowRaise(false);
    setRaiseAmount(minRaise);
  };

  if (!isMyTurn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg p-4 text-sm text-cdm-fg-muted">
        <div>상대 차례를 기다리는 중...</div>
        {gameData.phase === 'betting' && gameData.currentTurnSeatIdx !== null && (
          <div className="text-xs">좌석 {gameData.currentTurnSeatIdx + 1} 베팅 중</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-cdm-md border border-cdm-primary bg-cdm-primary/5 p-3 sm:p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-cdm-primary">내 차례</div>

      {showRaise ? (
        <div className="flex flex-col gap-2 rounded-lg border border-cdm-border bg-cdm-bg/60 p-3">
          <div className="flex items-center justify-between text-xs text-cdm-fg-muted">
            <span>레이즈 금액</span>
            <span className="tabular-nums">최소 {minRaise} · 최대 {maxRaise}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={minRaise}
              max={Math.max(maxRaise, minRaise)}
              value={safeRaise}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="flex-1 accent-cdm-primary"
            />
            <input
              type="number"
              min={minRaise}
              max={maxRaise}
              value={safeRaise}
              onChange={(e) => setRaiseAmount(Math.trunc(Number(e.target.value) || minRaise))}
              className="h-8 w-16 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 text-sm tabular-nums"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => { sfxRaise(); send({ type: 'raise', amount: safeRaise }); }}
              className="flex-1"
            >
              레이즈 ({safeRaise})
            </Button>
            {isAllIn && (
              <Button
                variant="secondary"
                onClick={() => { sfxRaise(); send({ type: 'raise', amount: maxRaise }); }}
                className="whitespace-nowrap font-semibold"
              >
                올인
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowRaise(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canCheck ? (
            <Button variant="secondary" onClick={() => { sfxCall(); send({ type: 'check' }); }}>
              체크
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canCall}
              onClick={() => { sfxCall(); send({ type: 'call' }); }}
              className={cn(!canCall && 'opacity-40')}
            >
              {callCost > 0 ? `콜 (${callCost})` : '콜'}
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={!canRaise}
            onClick={() => { setRaiseAmount(minRaise); setShowRaise(true); }}
            className={cn(!canRaise && 'opacity-40')}
          >
            레이즈
          </Button>
          <Button
            variant="secondary"
            disabled={!canRaise}
            onClick={() => { sfxRaise(); send({ type: 'raise', amount: maxRaise }); }}
            className={cn(
              'font-semibold text-amber-700 ring-1 ring-amber-300 hover:bg-amber-50 disabled:ring-0',
              !canRaise && 'opacity-40',
            )}
          >
            {isAllIn ? '올인' : `올인 (${maxRaise})`}
          </Button>
          <Button variant="danger" onClick={() => { sfxDie(); send({ type: 'die' }); }}>
            다이
          </Button>
        </div>
      )}
    </div>
  );
}
