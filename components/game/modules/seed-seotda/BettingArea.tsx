'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import Button from '@/components/ui/Button';
import type { SeedSeotdaGameData } from '@/shared/types/seed-seotda';
import { useState } from 'react';

export function BettingArea({ gameData, myId }: { gameData: SeedSeotdaGameData; myId: string }) {
  const sendAction = useGameAction();
  const [showRaise, setShowRaise] = useState(false);
  const initialValue = gameData.bettingOpened ? (gameData.minRaise ?? 0) : (gameData.minBet ?? 1);
  const [amount, setAmount] = useState(initialValue);
  if (gameData.phase !== 'betting') return null;
  const myTurn = gameData.currentTurnId === myId && gameData.players[myId] != null;
  if (!myTurn) {
    const currentName = gameData.currentTurnId
      ? gameData.players[gameData.currentTurnId]?.nickname
      : null;
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-4 text-center">
        <p className="text-cdm-fg-muted animate-pulse text-sm font-bold">
          {currentName ? `${currentName} 님이 베팅 중입니다` : '베팅을 기다리는 중입니다'}
        </p>
      </div>
    );
  }

  if (!gameData.bettingOpened && gameData.minBet != null && gameData.maxBet != null) {
    const safeAmount = Math.min(gameData.maxBet, Math.max(gameData.minBet, amount));
    return (
      <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
        <div className="flex items-center gap-3">
          <input
            className="accent-cdm-primary min-w-0 flex-1"
            type="range"
            min={gameData.minBet}
            max={gameData.maxBet}
            value={safeAmount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
          <span className="text-cdm-fg w-12 text-right text-lg font-black tabular-nums">
            {safeAmount}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => sendAction({ type: 'bet', amount: safeAmount })}>
            베팅 {safeAmount}
          </Button>
          <Button variant="danger" onClick={() => sendAction({ type: 'die' })}>
            다이
          </Button>
        </div>
      </section>
    );
  }

  const minRaise = gameData.minRaise;
  const maxRaise = gameData.maxRaise;
  const safeRaise =
    minRaise != null && maxRaise != null ? Math.min(maxRaise, Math.max(minRaise, amount)) : 0;
  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-cdm-fg-muted">콜에 필요한 칩</span>
        <span className="text-cdm-fg text-base font-black tabular-nums">{gameData.toCall}</span>
      </div>
      {showRaise && minRaise != null && maxRaise != null ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              className="accent-cdm-primary min-w-0 flex-1"
              type="range"
              min={minRaise}
              max={maxRaise}
              value={safeRaise}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <span className="text-cdm-fg w-12 text-right text-lg font-black tabular-nums">
              {safeRaise}
            </span>
          </div>
          <p className="text-cdm-fg-muted text-center text-[11px]">
            이번 라운드 총 베팅 · {minRaise}–{maxRaise}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => sendAction({ type: 'raise', amount: safeRaise })}>
              레이즈 {safeRaise}
            </Button>
            <Button variant="ghost" onClick={() => setShowRaise(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => sendAction({ type: 'call' })}>콜 {gameData.toCall}</Button>
          <Button
            variant="secondary"
            disabled={minRaise == null}
            onClick={() => {
              setAmount(minRaise ?? 0);
              setShowRaise(true);
            }}
          >
            레이즈
          </Button>
          <Button variant="danger" onClick={() => sendAction({ type: 'die' })}>
            다이
          </Button>
        </div>
      )}
    </section>
  );
}
