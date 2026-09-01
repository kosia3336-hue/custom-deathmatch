'use client';

import { useMemo, useState } from 'react';
import { DoubleSidedPokerCard } from '@/components/game/cards';
import Button from '@/components/ui/Button';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import type {
  DoubleSidedPokerGameData,
  DoubleSidedPokerPlayerView,
  DoubleSidedPokerSide,
} from '@/shared/types/double-sided-poker';

const SELECTION_LABEL = {
  front: '앞면',
  back: '뒷면',
  both: '양면',
} as const;

function BetLane({
  label,
  amount,
  selected,
}: {
  label: string;
  amount: number;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-cdm-md flex items-center justify-between border px-2 py-1.5',
        selected ? 'border-cdm-highlight bg-cdm-highlight-soft' : 'border-cdm-border bg-cdm-bg',
      )}
    >
      <span className="text-cdm-fg-muted text-[10px] font-black sm:text-xs">{label} 베팅칸</span>
      <span className="text-cdm-fg text-sm font-black tabular-nums">{amount}칩</span>
    </div>
  );
}

function PlayerPanel({
  player,
  playerId,
  gameData,
  myId,
}: {
  player: DoubleSidedPokerPlayerView;
  playerId: string;
  gameData: DoubleSidedPokerGameData;
  myId: string;
}) {
  const isCurrent = gameData.currentTurnId === playerId;
  const selection = player.selection;
  return (
    <section
      className={cn(
        'rounded-cdm-lg min-w-0 border p-2.5 transition sm:p-3',
        isCurrent
          ? 'border-cdm-highlight bg-cdm-highlight-soft'
          : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-cdm-fg truncate text-xs font-black sm:text-sm">
            {player.nickname}
            {playerId === myId ? ' (나)' : ''}
          </p>
          <p className="text-cdm-fg-muted text-[10px] font-bold sm:text-xs">
            {playerId === gameData.firstPlayerId ? '선 플레이어' : '후 플레이어'}
            {selection ? ` · ${SELECTION_LABEL[selection]} 선택` : ' · 면 선택 전'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-cdm-primary text-base font-black tabular-nums sm:text-lg">
            {player.chips}칩
          </p>
          <p className="text-cdm-fg-muted text-[10px] font-bold">기준 베팅 {player.stake}</p>
        </div>
      </div>

      <div className="mt-2 flex items-end justify-center gap-2 sm:gap-3">
        {player.card && (
          <div className="text-center">
            <DoubleSidedPokerCard value={player.card.front} face="front" size="md" />
            <p className="text-cdm-fg mt-0.5 text-[10px] font-black">앞면 · 공개</p>
          </div>
        )}
        {player.card?.back != null && (
          <div className="text-center">
            <DoubleSidedPokerCard value={player.card.back} face="back" size="md" />
            <p className="text-cdm-fg mt-0.5 text-[10px] font-black">뒷면 · 본인 공개</p>
          </div>
        )}
      </div>
      {player.card && player.card.back == null && (
        <p className="text-cdm-fg-subtle mt-1 text-center text-[10px] font-bold">
          뒷면 숫자는 소유자만 확인할 수 있습니다.
        </p>
      )}

      <div className="mt-2 grid gap-1.5">
        <BetLane
          label="앞면"
          amount={player.frontBet}
          selected={selection === 'front' || selection === 'both'}
        />
        <BetLane
          label="뒷면"
          amount={player.backBet}
          selected={selection === 'back' || selection === 'both'}
        />
      </div>
    </section>
  );
}

function SidePicker({
  value,
  onChange,
}: {
  value: DoubleSidedPokerSide;
  onChange: (side: DoubleSidedPokerSide) => void;
}) {
  return (
    <div className="border-cdm-border bg-cdm-bg-elev-1 mb-3 grid grid-cols-2 gap-1 rounded-lg border p-1">
      {(['front', 'back'] as const).map((side) => (
        <button
          key={side}
          type="button"
          className={cn(
            'rounded-md px-3 py-2 text-xs font-black transition',
            value === side
              ? 'bg-cdm-primary text-white'
              : 'text-cdm-fg-muted hover:bg-cdm-bg-elev-2',
          )}
          onClick={() => onChange(side)}
        >
          {side === 'front' ? '앞면 선택' : '뒷면 선택'}
        </button>
      ))}
    </div>
  );
}

function BettingArea({ gameData, myId }: { gameData: DoubleSidedPokerGameData; myId: string }) {
  const mine = gameData.players[myId];
  const [side, setSide] = useState<DoubleSidedPokerSide>('front');
  const [showRaise, setShowRaise] = useState(false);
  const initialAmount = gameData.bettingOpened ? (gameData.minRaise ?? 1) : (gameData.minBet ?? 1);
  const [amount, setAmount] = useState(initialAmount);
  if (gameData.phase !== 'betting') return null;
  const myTurn = gameData.currentTurnId === myId && mine != null;
  if (!myTurn) {
    const currentName = gameData.currentTurnId
      ? gameData.players[gameData.currentTurnId]?.nickname
      : null;
    return (
      <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-4 text-center">
        <p className="text-cdm-fg-muted animate-pulse text-sm font-bold">
          {currentName ? `${currentName} 님이 베팅 중입니다` : '베팅을 기다리는 중입니다'}
        </p>
      </section>
    );
  }

  if (!gameData.bettingOpened && gameData.minBet != null && gameData.maxBet != null) {
    const safeAmount = Math.min(gameData.maxBet, Math.max(gameData.minBet, amount));
    return (
      <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
        <p className="text-cdm-fg mb-2 text-center text-xs font-black">
          베팅할 면과 칩을 선택하세요 · 체크 없음
        </p>
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            onClick={() =>
              getSocket().emit('game:action', { type: 'bet', side: 'front', amount: safeAmount })
            }
          >
            앞면 {safeAmount}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              getSocket().emit('game:action', { type: 'bet', side: 'back', amount: safeAmount })
            }
          >
            뒷면 {safeAmount}
          </Button>
          <Button
            variant="danger"
            onClick={() => getSocket().emit('game:action', { type: 'fold' })}
          >
            다이
          </Button>
        </div>
      </section>
    );
  }

  const needsSide = mine.selection == null;
  const minRaise = gameData.minRaise;
  const maxRaise = gameData.maxRaise;
  const safeRaise =
    minRaise != null && maxRaise != null ? Math.min(maxRaise, Math.max(minRaise, amount)) : 0;
  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
      {needsSide && <SidePicker value={side} onChange={setSide} />}
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-cdm-fg-muted">
          {mine.selection === 'both' ? '두 베팅칸에 필요한 칩' : '콜에 필요한 칩'}
        </span>
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
            면별 기준 베팅 · {minRaise}–{maxRaise}
            {mine.selection === 'both' ? ' · 차액은 양쪽에 각각 지불' : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() =>
                getSocket().emit('game:action', {
                  type: 'raise',
                  side: needsSide ? side : undefined,
                  amount: safeRaise,
                })
              }
            >
              레이즈 {safeRaise}
            </Button>
            <Button variant="ghost" onClick={() => setShowRaise(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn('grid gap-2', gameData.canDouble ? 'grid-cols-4' : 'grid-cols-3')}>
          <Button
            onClick={() =>
              getSocket().emit('game:action', {
                type: 'call',
                side: needsSide ? side : undefined,
              })
            }
          >
            {gameData.toCall === 0 ? '콜 · 공개' : `콜 ${gameData.toCall}`}
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
          {gameData.canDouble && (
            <Button
              variant="secondary"
              onClick={() => getSocket().emit('game:action', { type: 'double' })}
            >
              양면 {gameData.doubleCost}
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => getSocket().emit('game:action', { type: 'fold' })}
          >
            다이
          </Button>
        </div>
      )}
      {gameData.canDouble && !showRaise && (
        <p className="text-cdm-highlight mt-2 text-center text-[10px] font-bold">
          양면베팅은 앞·뒷면에 {gameData.currentStake}칩씩 걸고, 성공 시 추가 10칩을 가져옵니다.
        </p>
      )}
    </section>
  );
}

function ResultArea({ gameData }: { gameData: DoubleSidedPokerGameData }) {
  const result = gameData.lastRoundResult;
  if (gameData.phase !== 'round-result' || !result) return null;
  const winnerName = result.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  const title =
    result.reason === 'tie'
      ? '같은 숫자 · 팟 이월'
      : result.reason === 'fold'
        ? `${winnerName ?? '상대'} 님이 다이 승리`
        : `${winnerName ?? '플레이어'} 님이 ${result.potAmount}칩 획득`;
  return (
    <section className="border-cdm-highlight bg-cdm-highlight-soft rounded-cdm-lg border p-3 text-center">
      <p className="text-cdm-fg text-base font-black">{title}</p>
      {result.doubleBonus > 0 && (
        <p className="text-cdm-accent mt-1 text-xs font-black">
          양면베팅 성공 · 상대에게서 추가 {result.doubleBonus}칩 획득
        </p>
      )}
      {result.reason === 'tie' && (
        <p className="text-cdm-fg-muted mt-1 text-[11px]">
          베팅된 칩을 그대로 두고 다음 라운드를 진행합니다.
        </p>
      )}
    </section>
  );
}

export default function DoubleSidedPokerGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as DoubleSidedPokerGameData | undefined;
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

  const orderedIds = gameData.players[myId]
    ? [myId, ...playerIds.filter((id) => id !== myId)]
    : playerIds;
  const actionKey = [
    gameData.round,
    gameData.phase,
    gameData.currentTurnId,
    gameData.bettingOpened,
    gameData.currentStake,
  ].join('-');

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-4">
      <header className="border-cdm-border bg-cdm-bg rounded-cdm-lg grid grid-cols-[1fr_auto] items-center gap-2 border p-2.5 sm:p-3">
        <div>
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.16em]">
            ROUND {gameData.round}
          </p>
          <p className="text-cdm-fg text-sm font-black">
            {gameData.phase === 'betting'
              ? gameData.doubleBettorId
                ? '양면베팅 응답'
                : '베팅'
              : gameData.phase === 'round-result'
                ? '라운드 결과'
                : '게임 종료'}
            {gameData.carryRound && <span className="text-cdm-highlight ml-2">팟 이월</span>}
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

      <main className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
        {orderedIds.map((playerId) => (
          <PlayerPanel
            key={playerId}
            player={gameData.players[playerId]}
            playerId={playerId}
            gameData={gameData}
            myId={myId}
          />
        ))}
      </main>

      <ResultArea gameData={gameData} />
      <BettingArea key={actionKey} gameData={gameData} myId={myId} />
      <p className="text-cdm-fg-subtle pb-1 text-center text-[10px]">
        앞면은 공개 · 뒷면은 본인만 확인 · 기본 베팅 1칩 · 체크 없음
      </p>
    </div>
  );
}
