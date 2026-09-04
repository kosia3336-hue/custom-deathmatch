'use client';

import { useMemo, useState } from 'react';
import { DoubleSidedPokerCard } from '@/components/game/cards';
import Button from '@/components/ui/Button';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import { GameFrame } from '@/components/game/GameFrame';
import type {
  DoubleSidedPokerGameData,
  DoubleSidedPokerPlayerView,
  DoubleSidedPokerSelection,
  DoubleSidedPokerSide,
} from '@/shared/types/double-sided-poker';

const SELECTION_LABEL = {
  front: '앞면',
  back: '뒷면',
  both: '양면',
} as const;

/**
 * 베팅판 — 가로로 긴 직사각형 하나를 앞면·뒷면 절반씩 나눈다.
 *
 * 여백 없이 딱 붙여 '판' 처럼 보이게 한다. 앞면·뒷면의 좌우 위치는 두 사람이
 * 똑같다. 상대 쪽만 좌우를 뒤집으면 같은 면끼리 세로로 마주 보지 않아 베팅액을
 * 견주기 어렵다 — 실제로 헷갈린다는 말을 듣고 되돌렸다.
 */
function BetBoard({
  frontBet,
  backBet,
  selection,
}: {
  frontBet: number;
  backBet: number;
  selection: DoubleSidedPokerSelection;
}) {
  const ordered = [
    { side: 'front' as const, label: '앞면', amount: frontBet },
    { side: 'back' as const, label: '뒷면', amount: backBet },
  ];
  return (
    <div className="border-cdm-border-strong -mx-1.5 grid grid-cols-2 border-y">
      {ordered.map((lane, index) => {
        const picked = selection === lane.side || selection === 'both';
        return (
          <div
            key={lane.side}
            className={cn(
              'flex items-baseline justify-between gap-1 px-3 py-2',
              // 가운데 칸막이 한 줄만 둔다. 바깥 테두리는 판 전체가 갖는다.
              index === 0 && 'border-cdm-border-strong border-r',
              picked ? 'bg-cdm-highlight-soft' : 'bg-cdm-bg',
            )}
          >
            <span
              className={cn(
                'text-[11px] font-black',
                picked ? 'text-cdm-highlight' : 'text-cdm-fg-muted',
              )}
            >
              {lane.label}
            </span>
            <span className="text-cdm-fg text-xl leading-6 font-black tabular-nums">
              {lane.amount}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 한 사람의 자리.
 *
 * mirrored(상대) 이면 위아래만 뒤집는다 — 이름이 바깥쪽, 베팅판이 안쪽(화면
 * 가운데)으로 온다. 그래야 두 사람의 베팅판이 가운데에서 맞닿아 실제 판처럼
 * 보인다. 좌우는 뒤집지 않는다(BetBoard 주석 참고).
 */
function PlayerPanel({
  player,
  playerId,
  gameData,
  myId,
  mirrored,
}: {
  player: DoubleSidedPokerPlayerView;
  playerId: string;
  gameData: DoubleSidedPokerGameData;
  myId: string;
  mirrored: boolean;
}) {
  const isCurrent = gameData.currentTurnId === playerId;
  const selection = player.selection;

  const header = (
    <div className="flex items-baseline justify-between gap-2">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <p className="text-cdm-fg truncate text-xs font-black">
          {player.nickname}
          {playerId === myId ? ' (나)' : ''}
        </p>
        <p className="text-cdm-fg-muted shrink-0 text-[10px] font-bold">
          {playerId === gameData.firstPlayerId ? '선' : '후'}
          {selection ? ` · ${SELECTION_LABEL[selection]}` : ' · 면 선택 전'}
        </p>
      </div>
      <p className="text-cdm-primary shrink-0 text-base font-black tabular-nums">
        {player.chips}칩
      </p>
    </div>
  );

  /*
    카드 줄은 낮게 유지한다. 여기서 아낀 높이가 그대로 베팅판으로 간다.
    어느 쪽이 앞·뒷면인지는 바로 붙어 있는 베팅판이 이미 말해 준다.
  */
  const cards = (
    <div className="flex items-center justify-center gap-2">
      {player.card && <DoubleSidedPokerCard value={player.card.front} face="front" size="sm" />}
      {player.card?.back != null && (
        <DoubleSidedPokerCard value={player.card.back} face="back" size="sm" />
      )}
      {player.card && player.card.back == null && (
        // 크기는 sm 카드(60×83)에 맞춘다. 나란히 놓였을 때 한 장만 작아 보이면 어색하다.
        <span className="border-cdm-border-strong bg-cdm-bg-elev-2 text-cdm-fg-subtle rounded-cdm-sm flex aspect-[60/83] w-[60px] items-center justify-center border text-lg font-black">
          ?
        </span>
      )}
    </div>
  );

  const board = (
    <BetBoard frontBet={player.frontBet} backBet={player.backBet} selection={selection} />
  );

  return (
    <section
      className={cn(
        'rounded-cdm-lg flex min-w-0 flex-col justify-center gap-0.5 overflow-hidden border px-1.5 py-0.5 transition',
        isCurrent
          ? 'border-cdm-highlight bg-cdm-highlight-soft'
          : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      {mirrored ? (
        <>
          {header}
          {cards}
          {board}
        </>
      ) : (
        <>
          {board}
          {cards}
          {header}
        </>
      )}
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
    <div className="border-cdm-border bg-cdm-bg-elev-1 mb-2 grid grid-cols-2 gap-1 rounded-lg border p-0.5">
      {(['front', 'back'] as const).map((side) => (
        <button
          key={side}
          type="button"
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-black transition',
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
  const [showDouble, setShowDouble] = useState(false);
  const initialAmount = gameData.bettingOpened ? (gameData.minRaise ?? 1) : (gameData.minBet ?? 1);
  const [amount, setAmount] = useState(initialAmount);
  if (gameData.phase !== 'betting') return null;
  const myTurn = gameData.currentTurnId === myId && mine != null;

  /*
    질 게 뻔한 양면베팅을 막아 준다.

    양면베팅은 내 앞면과 뒷면이 상대가 고른 숫자보다 '둘 다' 커야 이긴다.
    그러니 내 두 숫자 중 작은 쪽이 상대가 고를 수 있는 숫자 이하라면 승부에서는
    절대 이길 수 없다. 상대의 앞면은 공개되어 있으므로 그 경우를 미리 짚어 준다.

    상대가 이미 뒷면을 골랐다면 그 숫자를 알 수 없어 판단하지 않는다.
    상대가 다이하면 이길 수도 있으므로 막지 않고 묻기만 한다.
  */
  function confirmDouble() {
    const card = mine?.card;
    if (!card || card.back == null) return true;
    const opponent = Object.entries(gameData.players).find(([id]) => id !== myId)?.[1];
    if (!opponent?.card) return true;
    if (opponent.selection === 'back' || opponent.selection === 'both') return true;
    if (Math.min(card.front, card.back) > opponent.card.front) return true;
    return window.confirm('무조건 패배하게 됩니다. 정말 진행합니까?');
  }

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
    const canOpenDouble = gameData.canDouble && gameData.maxDouble != null;
    const safeDouble = gameData.maxDouble != null ? Math.min(gameData.maxDouble, safeAmount) : 0;
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
        <div
          className={cn('mt-3 grid gap-2', canOpenDouble ? 'grid-cols-4' : 'grid-cols-3')}
        >
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
          {canOpenDouble && (
            <Button
              variant="secondary"
              onClick={() => {
                if (!confirmDouble()) return;
                getSocket().emit('game:action', { type: 'double', amount: safeDouble });
              }}
            >
              양면 {safeDouble * 2}
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => getSocket().emit('game:action', { type: 'fold' })}
          >
            다이
          </Button>
        </div>
        {canOpenDouble && (
          <p className="text-cdm-highlight mt-2 text-center text-[10px] font-bold">
            양면베팅은 앞·뒷면에 {safeDouble}칩씩({safeDouble * 2}칩) 걸고, 성공 시 추가 10칩을
            가져옵니다.
          </p>
        )}
      </section>
    );
  }

  const needsSide = mine.selection == null;
  const minRaise = gameData.minRaise;
  const maxRaise = gameData.maxRaise;
  const safeRaise =
    minRaise != null && maxRaise != null ? Math.min(maxRaise, Math.max(minRaise, amount)) : 0;
  const safeDoubleStake =
    gameData.maxDouble != null
      ? Math.min(gameData.maxDouble, Math.max(gameData.currentStake, amount))
      : 0;
  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
      {needsSide && <SidePicker value={side} onChange={setSide} />}
      {/* 양면 금액을 고르는 중에는 콜 비용을 띄우지 않는다. 지금 고르는 값과 헷갈린다. */}
      <div
        className={cn(
          'mb-2 flex items-center justify-between gap-3 text-xs',
          showDouble && 'hidden',
        )}
      >
        <span className="text-cdm-fg-muted">
          {mine.selection === 'both' ? '두 베팅칸에 필요한 칩' : '콜에 필요한 칩'}
        </span>
        <span className="text-cdm-fg text-base font-black tabular-nums">
          {gameData.toCall}
          {/*
            양면베팅은 앞뒤 두 칸에 똑같이 걸므로 실제로 나가는 칩이 두 배다.
            총액만 보면 왜 이 숫자인지 안 보여서 '6(2×3)' 처럼 내역을 함께 적는다.
          */}
          {mine.selection === 'both' && gameData.toCall > 0 && (
            <span className="text-cdm-fg-muted ml-0.5 text-xs font-bold">
              (2×{gameData.toCall / 2})
            </span>
          )}
        </span>
      </div>

      {showDouble && gameData.canDouble && gameData.maxDouble != null ? (
        /*
          양면베팅도 금액을 고른다. 기준액을 그대로 맞추면 콜과 같고, 그보다
          높이 걸면 양면 레이즈가 된다. 앞뒤 두 칸에 각각 내므로 실제로 나가는
          칩은 두 배다.
        */
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              className="accent-cdm-primary min-w-0 flex-1"
              type="range"
              min={gameData.currentStake}
              max={gameData.maxDouble}
              value={safeDoubleStake}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <span className="text-cdm-fg w-20 text-right text-lg font-black tabular-nums">
              {safeDoubleStake * 2}
              <span className="text-cdm-fg-muted ml-0.5 text-xs font-bold">
                (2×{safeDoubleStake})
              </span>
            </span>
          </div>
          <p className="text-cdm-fg-muted text-center text-[10px]">
            면별 {gameData.currentStake}–{gameData.maxDouble} · {gameData.currentStake}이면 맞추기,
            더 걸면 양면 레이즈
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                if (!confirmDouble()) return;
                setShowDouble(false);
                getSocket().emit('game:action', { type: 'double', amount: safeDoubleStake });
              }}
            >
              양면 {safeDoubleStake * 2}
            </Button>
            <Button variant="ghost" onClick={() => setShowDouble(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : showRaise && minRaise != null && maxRaise != null ? (
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
              onClick={() => {
                setAmount(gameData.currentStake);
                setShowDouble(true);
              }}
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
      {gameData.canDouble && !showRaise && !showDouble && (
        <p className="text-cdm-highlight mt-2 text-center text-[10px] font-bold">
          양면베팅 — 앞뒤에 같은 칩 · {gameData.currentStake}칩씩부터 · 성공 시 +10칩
        </p>
      )}
    </section>
  );
}

function ResultOverlay({ gameData }: { gameData: DoubleSidedPokerGameData }) {
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
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="border-cdm-highlight bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
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
      </div>
    </div>
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

  // 상대가 위, 내가 아래. 관전자는 원래 순서를 그대로 쓴다.
  const seatOrder = gameData.players[myId]
    ? [...playerIds.filter((id) => id !== myId), myId]
    : playerIds;
  const actionKey = [
    gameData.round,
    gameData.phase,
    gameData.currentTurnId,
    gameData.bettingOpened,
    gameData.currentStake,
  ].join('-');

  return (
    <GameFrame
      info={
        <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg flex items-center justify-between gap-2 border px-2 py-1.5">
          <div className="min-w-0">
            <p className="text-cdm-fg-subtle text-[9px] leading-3 font-bold tracking-[0.16em]">
              ROUND {gameData.round}
            </p>
            <p className="text-cdm-fg truncate text-xs leading-4 font-black">
              {gameData.phase === 'betting'
                ? gameData.doubleBettorId
                  ? '양면베팅 응답'
                  : '베팅'
                : gameData.phase === 'round-result'
                  ? '라운드 결과'
                  : '게임 종료'}
              {gameData.carryRound && <span className="text-cdm-highlight ml-1.5">팟 이월</span>}
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
        <div className="flex flex-col gap-1.5">
          <BettingArea key={actionKey} gameData={gameData} myId={myId} />
        </div>
      }
    >
      {/*
        상대가 위, 내가 아래. 두 사람의 베팅판이 화면 가운데에서 맞닿도록
        상대 자리는 180도 돌린 모양으로 둔다.
      */}
      <main className="mx-auto flex h-full w-full max-w-xl min-w-0 flex-col justify-center gap-1.5 overflow-hidden">
        {seatOrder.map((playerId) => (
          <PlayerPanel
            key={playerId}
            player={gameData.players[playerId]}
            playerId={playerId}
            gameData={gameData}
            myId={myId}
            mirrored={playerId !== myId}
          />
        ))}
      </main>

      {/* 결과는 무대 위에 겹쳐 띄운다 — 새 줄로 만들면 그 순간 판이 밀린다. */}
      <ResultOverlay gameData={gameData} />
    </GameFrame>
  );
}
