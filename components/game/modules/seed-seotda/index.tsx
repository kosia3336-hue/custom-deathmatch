'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { SeedSeotdaCard } from '@/components/game/cards';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import type {
  SeedSeotdaGameData,
  SeedSeotdaPlayerView,
} from '@/shared/types/seed-seotda';

const PHASE_LABEL: Record<SeedSeotdaGameData['phase'], string> = {
  'seed-choice': '시드 선택',
  betting: '베팅',
  'round-result': '라운드 결과',
  finished: '게임 종료',
};

function HandCards({ player }: { player: SeedSeotdaPlayerView }) {
  const cards = player.finalHand.length > 0 ? player.finalHand : player.cards;
  const visibleCards = cards.length > 0 ? cards : [null, null];
  return (
    <div className="mt-2 flex justify-center gap-1 sm:gap-2">
      {visibleCards.map((card, index) => (
        <SeedSeotdaCard key={`${card?.id ?? 'hidden'}-${index}`} card={card} size="sm" />
      ))}
    </div>
  );
}

function PlayerPanel({
  player,
  playerId,
  gameData,
  myId,
}: {
  player: SeedSeotdaPlayerView;
  playerId: string;
  gameData: SeedSeotdaGameData;
  myId: string;
}) {
  const current = gameData.currentTurnId === playerId;
  const evaluation = gameData.lastRoundResult?.evaluations[playerId];
  const choiceLabel =
    player.seedChoice === 'used'
      ? '시드 사용'
      : player.seedChoice === 'unused'
        ? '시드 미사용'
        : '선택 전';
  return (
    <section
      className={cn(
        'rounded-cdm-lg border p-2.5 text-center transition sm:p-3',
        current
          ? 'border-cdm-highlight bg-cdm-highlight-soft'
          : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-left">
        <div className="min-w-0">
          <p className="text-cdm-fg truncate text-xs font-black sm:text-sm">
            {player.nickname}
            {playerId === myId ? ' (나)' : ''}
          </p>
          <p className="text-cdm-fg-muted text-[10px] font-bold sm:text-xs">
            {playerId === gameData.firstPlayerId ? '선 플레이어' : '후 플레이어'} · {choiceLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-cdm-primary text-base font-black tabular-nums sm:text-lg">
            {player.chips}칩
          </p>
          <p className="text-cdm-fg-muted text-[10px] font-bold">베팅 {player.roundBet}</p>
        </div>
      </div>
      <HandCards player={player} />
      {evaluation && (
        <p className="text-cdm-fg mt-1 text-xs font-black sm:text-sm">{evaluation.name}</p>
      )}
    </section>
  );
}

function SeedChoiceArea({ gameData, myId }: { gameData: SeedSeotdaGameData; myId: string }) {
  const [discardIndex, setDiscardIndex] = useState<0 | 1 | null>(null);
  if (gameData.phase !== 'seed-choice') return null;
  const mine = gameData.players[myId];
  const myTurn = gameData.currentTurnId === myId && mine != null;
  if (!myTurn) {
    const currentName = gameData.currentTurnId
      ? gameData.players[gameData.currentTurnId]?.nickname
      : null;
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3 text-center">
        <p className="text-cdm-fg-muted animate-pulse text-sm font-bold">
          {currentName
            ? `${currentName} 님이 시드 사용을 결정하고 있습니다`
            : '선택을 기다리는 중입니다'}
        </p>
      </div>
    );
  }

  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3 text-center">
      <p className="text-cdm-fg text-sm font-black">버릴 패를 고르거나 시드를 사용하지 마세요</p>
      <p className="text-cdm-fg-muted mt-0.5 text-[11px]">
        버린 패의 정체는 상대에게 공개되지 않습니다.
      </p>
      <div className="mt-3 flex justify-center gap-3">
        {mine.cards.map((card, index) => (
          <button
            key={card?.id ?? index}
            type="button"
            className={cn(
              'rounded-cdm-md border-2 p-1 transition focus-visible:outline-2',
              discardIndex === index
                ? 'border-cdm-accent bg-cdm-accent-soft outline-cdm-accent'
                : 'hover:border-cdm-highlight outline-cdm-highlight border-transparent',
            )}
            onClick={() => setDiscardIndex(index as 0 | 1)}
            aria-label={`${index + 1}번째 카드를 버릴 패로 선택`}
          >
            <SeedSeotdaCard card={card} size="md" />
            <span className="text-cdm-accent mt-0.5 block text-[10px] font-black">
              {discardIndex === index ? '버릴 패' : '선택'}
            </span>
          </button>
        ))}
      </div>
      <div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-2">
        <Button
          disabled={discardIndex == null}
          onClick={() => {
            if (discardIndex == null) return;
            getSocket().emit('game:action', { type: 'use-seed', discardIndex });
          }}
        >
          시드 사용
        </Button>
        <Button
          variant="secondary"
          onClick={() => getSocket().emit('game:action', { type: 'skip-seed' })}
        >
          시드 미사용
        </Button>
      </div>
    </section>
  );
}

function BettingArea({ gameData, myId }: { gameData: SeedSeotdaGameData; myId: string }) {
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
          <Button
            onClick={() => getSocket().emit('game:action', { type: 'bet', amount: safeAmount })}
          >
            베팅 {safeAmount}
          </Button>
          <Button variant="danger" onClick={() => getSocket().emit('game:action', { type: 'die' })}>
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
          <p className="text-cdm-fg-muted text-center text-[10px]">
            이번 라운드 총 베팅 · {minRaise}–{maxRaise}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => getSocket().emit('game:action', { type: 'raise', amount: safeRaise })}
            >
              레이즈 {safeRaise}
            </Button>
            <Button variant="ghost" onClick={() => setShowRaise(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => getSocket().emit('game:action', { type: 'call' })}>
            콜 {gameData.toCall}
          </Button>
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
          <Button variant="danger" onClick={() => getSocket().emit('game:action', { type: 'die' })}>
            다이
          </Button>
        </div>
      )}
    </section>
  );
}

function ResultArea({ gameData }: { gameData: SeedSeotdaGameData }) {
  const result = gameData.lastRoundResult;
  if (gameData.phase !== 'round-result' || !result) return null;
  const winnerName = result.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  const title =
    result.reason === 'tie'
      ? '동일 족보 · 재경기'
      : result.reason === 'gusa-rematch'
        ? '구사 · 재경기'
        : result.reason === 'mung-gusa-rematch'
          ? '멍텅구리 구사 · 재경기'
          : result.reason === 'die'
            ? `${winnerName ?? '상대'} 님이 다이 승리`
            : `${winnerName ?? '플레이어'} 님이 ${result.potAmount}칩 획득`;
  return (
    <section className="border-cdm-highlight bg-cdm-highlight-soft rounded-cdm-lg border p-3 text-center">
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
    </section>
  );
}

export default function SeedSeotdaGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as SeedSeotdaGameData | undefined;
  const myId = useMySocketId();
  const { remaining } = useTurnTimer();
  const playerIds = useMemo(() => (gameData ? Object.keys(gameData.players) : []), [gameData]);

  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }

  const orderedPlayerIds = gameData.players[myId]
    ? [myId, ...playerIds.filter((id) => id !== myId)]
    : playerIds;
  const actionKey = `${gameData.round}-${gameData.phase}-${gameData.currentTurnId}-${gameData.bettingOpened}`;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-4">
      <header className="border-cdm-border bg-cdm-bg rounded-cdm-lg grid grid-cols-[1fr_auto] items-center gap-2 border p-2.5 sm:p-3">
        <div>
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.16em]">
            ROUND {gameData.round}
          </p>
          <p className="text-cdm-fg text-sm font-black">
            {PHASE_LABEL[gameData.phase]}
            {gameData.carryRound && <span className="text-cdm-highlight ml-2">재경기</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 text-center">
          <div>
            <p className="text-cdm-fg-subtle text-[9px] font-bold">DECK</p>
            <p className="text-cdm-fg text-lg font-black">{gameData.deckRemaining}</p>
          </div>
          <div className="bg-cdm-primary-soft rounded-cdm-md min-w-16 px-3 py-1.5">
            <p className="text-cdm-primary text-[9px] font-bold">POT</p>
            <p className="text-cdm-primary text-xl font-black tabular-nums">{gameData.pot}</p>
          </div>
          <div>
            <p className="text-cdm-fg-subtle text-[9px] font-bold">TIME</p>
            <p
              className={cn(
                'text-cdm-fg text-lg font-black tabular-nums',
                remaining != null && remaining <= 10 && 'text-cdm-accent',
              )}
            >
              {remaining == null ? '∞' : Math.ceil(remaining)}
            </p>
          </div>
        </div>
      </header>

      <main className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-xl flex flex-col items-center gap-2 border p-3 sm:gap-3 sm:p-4">
        <div className="text-center">
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.14em]">SEED</p>
          <SeedSeotdaCard card={gameData.seedCard} size="lg" className="mt-1" />
          <p className="text-cdm-fg mt-0.5 text-xs font-black">공용 시드패</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:gap-3">
          {orderedPlayerIds.map((playerId) => (
            <PlayerPanel
              key={playerId}
              player={gameData.players[playerId]}
              playerId={playerId}
              gameData={gameData}
              myId={myId}
            />
          ))}
        </div>
      </main>

      <ResultArea gameData={gameData} />
      <SeedChoiceArea key={`seed-${actionKey}`} gameData={gameData} myId={myId} />
      <BettingArea key={`bet-${actionKey}`} gameData={gameData} myId={myId} />

      <p className="text-cdm-fg-subtle pb-1 text-center text-[10px]">
        기본 베팅 1칩 · 덱 소진 시 20장 새 덱으로 교체
      </p>
    </div>
  );
}
