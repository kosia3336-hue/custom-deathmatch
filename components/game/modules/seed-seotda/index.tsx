'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { SeedSeotdaCard } from '@/components/game/cards';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import { GameFrame } from '@/components/game/GameFrame';
import type { SeedSeotdaGameData, SeedSeotdaPlayerView } from '@/shared/types/seed-seotda';

const PHASE_LABEL: Record<SeedSeotdaGameData['phase'], string> = {
  'seed-choice': '패 버리기',
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
  const evaluation = player.evaluation;
  const choiceLabel =
    player.seedChoice === 'used'
      ? '패 버림'
      : player.seedChoice === 'unused'
        ? '안 버림'
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
        <p className="text-cdm-fg mt-1 text-xs font-black sm:text-sm">
          {playerId === myId && gameData.phase !== 'round-result' ? '내 족보 · ' : ''}
          {evaluation.name}
        </p>
      )}
    </section>
  );
}

function SeedChoiceArea({ gameData, myId }: { gameData: SeedSeotdaGameData; myId: string }) {
  const [discardIndex, setDiscardIndex] = useState<0 | 1 | null>(null);
  if (gameData.phase !== 'seed-choice') return null;
  const mine = gameData.players[myId];
  if (!mine) {
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3 text-center">
        <p className="text-cdm-fg-muted animate-pulse text-sm font-bold">
          두 플레이어가 버릴 패를 고르고 있습니다
        </p>
      </div>
    );
  }

  /*
    동시 제출이다. 내가 냈으면 상대를 기다리고, 상대가 무엇을 골랐는지는 둘 다
    낼 때까지 보이지 않는다(서버가 감춘다).
  */
  if (mine.seedChoice !== 'pending') {
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3 text-center">
        <p className="text-cdm-fg text-sm font-black">
          {mine.seedChoice === 'used' ? '패 한 장을 버렸습니다' : '패를 버리지 않았습니다'}
        </p>
        <p className="text-cdm-fg-muted mt-0.5 animate-pulse text-[11px] font-bold">
          상대의 제출을 기다리는 중입니다
        </p>
      </div>
    );
  }

  /*
    조작부는 낮게. 여기가 커지면 그만큼 무대(내 패·상대 패)가 눌려 잘린다.
    카드를 작게 하고 고르는 줄과 단추 줄을 한 칸씩만 쓴다.
  */
  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2 text-center">
      <p className="text-cdm-fg text-[11px] leading-4 font-black">
        버릴 패를 고르세요. 버리면 시드패와 남은 한 장으로 겨룹니다.
      </p>
      <div className="mt-1.5 flex justify-center gap-2">
        {mine.cards.map((card, index) => (
          <button
            key={card?.id ?? index}
            type="button"
            className={cn(
              'rounded-cdm-md border-2 p-0.5 transition focus-visible:outline-2',
              discardIndex === index
                ? 'border-cdm-accent bg-cdm-accent-soft outline-cdm-accent'
                : 'hover:border-cdm-highlight outline-cdm-highlight border-transparent',
            )}
            onClick={() => setDiscardIndex(index as 0 | 1)}
            aria-label={`${index + 1}번째 카드를 버릴 패로 선택`}
          >
            <SeedSeotdaCard card={card} size="sm" />
            <span className="text-cdm-accent mt-0.5 block text-[10px] leading-3 font-black">
              {discardIndex === index ? '버릴 패' : '선택'}
            </span>
          </button>
        ))}
      </div>
      <div className="mx-auto mt-1.5 grid max-w-md grid-cols-2 gap-2">
        <Button
          disabled={discardIndex == null}
          onClick={() => {
            if (discardIndex == null) return;
            getSocket().emit('game:action', { type: 'use-seed', discardIndex });
          }}
        >
          패 버리기
        </Button>
        <Button
          variant="secondary"
          onClick={() => getSocket().emit('game:action', { type: 'skip-seed' })}
        >
          버리지 않기
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

function ResultOverlay({ gameData }: { gameData: SeedSeotdaGameData }) {
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
    <GameFrame
      info={
        <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg flex items-center justify-between gap-2 border px-2 py-1.5">
          <div className="min-w-0">
            <p className="text-cdm-fg-subtle text-[9px] leading-3 font-bold tracking-[0.16em]">
              ROUND {gameData.round}
            </p>
            <p className="text-cdm-fg truncate text-xs leading-4 font-black">
              {PHASE_LABEL[gameData.phase]}
              {gameData.carryRound && <span className="text-cdm-highlight ml-1.5">재경기</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5 text-center">
            <div>
              <p className="text-cdm-fg-subtle text-[9px] leading-3 font-bold">DECK</p>
              <p className="text-cdm-fg text-sm leading-4 font-black tabular-nums">
                {gameData.deckRemaining}
              </p>
            </div>
            <div className="bg-cdm-primary-soft rounded-cdm-md px-2.5 py-0.5">
              <p className="text-cdm-primary text-[9px] leading-3 font-bold">POT</p>
              <p className="text-cdm-primary text-base leading-5 font-black tabular-nums">
                {gameData.pot}
              </p>
            </div>
            <div>
              <p className="text-cdm-fg-subtle text-[9px] leading-3 font-bold">TIME</p>
              <p
                className={cn(
                  'text-cdm-fg text-sm leading-4 font-black tabular-nums',
                  remaining != null && remaining <= 10 && 'text-cdm-accent',
                )}
              >
                {remaining == null ? '∞' : Math.ceil(remaining)}
              </p>
            </div>
          </div>
        </div>
      }
      controls={
        <div className="flex flex-col gap-2">
          <SeedChoiceArea key={`seed-${actionKey}`} gameData={gameData} myId={myId} />
          <BettingArea key={`bet-${actionKey}`} gameData={gameData} myId={myId} />
        </div>
      }
    >
      <main className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-xl flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden border p-1.5 sm:gap-3 sm:p-4">
        <div className="text-center">
          <p className="text-cdm-fg-subtle text-[10px] leading-3 font-bold tracking-[0.14em]">
            SEED
          </p>
          <SeedSeotdaCard card={gameData.seedCard} size="md" className="mt-0.5" />
          <p className="text-cdm-fg mt-0.5 text-[11px] leading-3 font-black">공용 시드패</p>
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

      {/* 결과는 무대 위에 겹쳐 띄운다 — 새 줄로 만들면 그 순간 판이 밀린다. */}
      <ResultOverlay gameData={gameData} />
    </GameFrame>
  );
}
