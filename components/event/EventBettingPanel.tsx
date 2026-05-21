'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { IPEGameData, IPEPlayerInfo } from '@/shared/types';
import { sfxCall, sfxRaise, sfxDie } from '@/lib/eventSfx';

interface Props {
  mySeat: IPEPlayerInfo;
  gameData: IPEGameData;
  isMyTurn: boolean;
}

export default function EventBettingPanel({ mySeat, gameData, isMyTurn }: Props) {
  const [raiseAmount, setRaiseAmount] = useState<number>(gameData.currentBet + 1);

  // 라운드 베팅 변경 시 raise 최소값을 따라가게
  // (간단히 currentBet+1 을 기본으로)
  const minRaise = Math.max(gameData.currentBet + 1, 1);
  // 생존 플레이어 중 최소 칩 기준 (올인 방지)
  const minChipsAlive = Math.min(
    ...gameData.seats.filter((s) => s?.isAlive).map((s) => s!.chips + (s!.roundBet ?? 0)),
    mySeat.roundBet + mySeat.chips,
  );
  const maxRaise = minChipsAlive;
  const callCost = Math.max(0, gameData.currentBet - mySeat.roundBet);
  const canCheck = !gameData.bettingStarted && mySeat.roundBet >= gameData.currentBet;
  const canCall = !canCheck && callCost > 0 && mySeat.chips >= callCost;
  const canRaise = mySeat.chips > callCost && minRaise <= maxRaise;
  const canDie = true;

  const safeRaise = Math.max(minRaise, Math.min(maxRaise, raiseAmount));

  const send = (data: Record<string, unknown>) => {
    getSocket().emit('game:action', data);
  };

  if (!isMyTurn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg p-4 text-sm text-cdm-fg-muted">
        <div>상대 차례를 기다리는 중...</div>
        {gameData.phase === 'betting' && gameData.currentTurnSeatIdx !== null && (
          <div className="text-xs">
            좌석 {gameData.currentTurnSeatIdx + 1} 의 베팅 중
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-cdm-md border border-cdm-primary bg-cdm-primary/5 p-3 sm:p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-cdm-primary">내 차례</div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!canCheck}
          onClick={() => { sfxCall(); send({ type: 'check' }); }}
          className={cn(!canCheck && 'opacity-40')}
        >
          체크
        </Button>
        <Button
          variant="primary"
          disabled={!canCall}
          onClick={() => { sfxCall(); send({ type: 'call' }); }}
          className={cn(!canCall && 'opacity-40')}
        >
          콜 {callCost > 0 ? `(${callCost})` : ''}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-cdm-fg-muted">
          <span>레이즈 (최소 {minRaise} / 최대 {maxRaise})</span>
          <span className="tabular-nums">총 {safeRaise}</span>
        </div>
        <input
          type="range"
          min={minRaise}
          max={Math.max(maxRaise, minRaise)}
          value={safeRaise}
          disabled={!canRaise}
          onChange={(e) => setRaiseAmount(Number(e.target.value))}
          className="w-full accent-cdm-primary"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={minRaise}
            max={maxRaise}
            value={safeRaise}
            disabled={!canRaise}
            onChange={(e) => setRaiseAmount(Math.trunc(Number(e.target.value) || minRaise))}
            className="h-9 w-20 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 text-sm tabular-nums"
          />
          <Button
            variant="primary"
            disabled={!canRaise}
            onClick={() => { sfxRaise(); send({ type: 'raise', amount: safeRaise }); }}
            className={cn('flex-1', !canRaise && 'opacity-40')}
          >
            레이즈
          </Button>
        </div>
      </div>

      <Button
        variant="danger"
        disabled={!canDie}
        onClick={() => { sfxDie(); send({ type: 'die' }); }}
      >
        다이
      </Button>

    </div>
  );
}
