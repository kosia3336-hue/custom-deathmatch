'use client';

import { useEffect, useMemo, useState } from 'react';
import { PlayingCard } from '@/components/game/cards';
import Button from '@/components/ui/Button';
import { useMySocketId } from '@/hooks/useMySocketId';
import { playChipsSfx } from '@/lib/chipsSfx';
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
      {/* 내 자리에는 이번 판에 내가 낸 칩(앞·뒤 합계)을 칩 수 옆에 함께 적는다 */}
      <div className="shrink-0 text-right">
        <p className="text-cdm-primary text-base leading-5 font-black tabular-nums">
          {player.chips}칩
        </p>
        {playerId === myId && (
          <p className="text-cdm-fg-muted text-[10px] leading-3 font-bold tabular-nums">
            (베팅 칩 : {player.frontBet + player.backBet}개)
          </p>
        )}
      </div>
    </div>
  );

  /*
    카드 줄은 낮게 유지한다. 여기서 아낀 높이가 그대로 베팅판으로 간다.
    어느 쪽이 앞·뒷면인지는 바로 붙어 있는 베팅판이 이미 말해 준다.
  */
  const cards = (
    <div className="flex items-center justify-center gap-2">
      {player.card && <PlayingCard value={player.card.front} face="front" size="sm" />}
      {player.card?.back != null && (
        <PlayingCard value={player.card.back} face="back" size="sm" />
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

/** 조작부의 세 갈래 — 앞면 · 뒷면 · 양면. */
type DoubleSidedPokerBranch = DoubleSidedPokerSide | 'both';

const BRANCH_LABEL: Record<DoubleSidedPokerBranch, string> = {
  front: '앞면 선택',
  back: '뒷면 선택',
  both: '양면 선택',
};

/**
 * 앞면·뒷면·양면을 한 줄의 세 갈래로 놓는다.
 *
 * 이 라운드에서 이미 면을 정했다면(locked) 고른 갈래만 보여 준다 — 바꿀 수
 * 없는 것을 누를 수 있게 두면 눌러 보고서야 안 된다는 걸 알게 된다.
 */
function BranchPicker({
  value,
  onChange,
  doubleEnabled,
  locked,
}: {
  value: DoubleSidedPokerBranch;
  onChange: (branch: DoubleSidedPokerBranch) => void;
  doubleEnabled: boolean;
  locked: boolean;
}) {
  if (locked) {
    return (
      <p className="text-cdm-fg-muted mb-2 text-center text-[11px] font-bold">
        이번 라운드 선택 —{' '}
        <span className="text-cdm-highlight font-black">{BRANCH_LABEL[value].slice(0, 2)}</span>
      </p>
    );
  }
  return (
    <div className="border-cdm-border bg-cdm-bg-elev-1 mb-2 grid grid-cols-3 gap-1 rounded-lg border p-0.5">
      {(['front', 'back', 'both'] as const).map((branch) => {
        const disabled = branch === 'both' && !doubleEnabled;
        return (
          <button
            key={branch}
            type="button"
            disabled={disabled}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-black transition',
              value === branch
                ? 'bg-cdm-primary text-white'
                : disabled
                  ? 'text-cdm-fg-subtle cursor-not-allowed'
                  : 'text-cdm-fg-muted hover:bg-cdm-bg-elev-2',
            )}
            onClick={() => onChange(branch)}
          >
            {BRANCH_LABEL[branch]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 나가는 칩. 양면이면 총액만으로는 왜 그 숫자인지 안 보이므로 '6(2×3)' 처럼
 * 내역을 함께 적는다. 곱셈의 앞은 늘 2다 — 앞뒤 두 칸에 같은 칩을 걸기 때문.
 */
function ChipCost({ total, perSide }: { total: number; perSide: number | null }) {
  return (
    <span className="text-cdm-fg text-base font-black tabular-nums">
      {total}
      {perSide != null && perSide > 0 && (
        <span className="text-cdm-fg-muted ml-0.5 text-xs font-bold">(2×{perSide})</span>
      )}
    </span>
  );
}

function BranchHint({ branch, stake }: { branch: DoubleSidedPokerBranch; stake: number | null }) {
  if (branch !== 'both' || stake == null) return null;
  return (
    <p className="text-cdm-highlight mt-2 text-center text-[10px] font-bold">
      양면베팅 — 앞·뒷면에 {stake}칩씩({stake * 2}칩) · 앞뒤가 모두 높아야 이기고, 성공 시 추가
      10칩
    </p>
  );
}

/**
 * 조작부 — '어느 면으로 갈지' 를 먼저 고르고, 그 다음에 '얼마를 낼지' 를 정한다.
 *
 * 예전에는 양면베팅만 별도 버튼과 별도 화면으로 빠져 있었다. 그래서 양면을 고른
 * 뒤에 레이즈하려면 다른 문으로 들어가야 했고, 필요한 칩도 콜 기준으로 굳은
 * 값이 남아 실제로 걸리는 칩과 달랐다. 앞면·뒷면·양면을 같은 줄의 세 갈래로
 * 놓으면 그 뒤는 콜·레이즈·다이 하나로 합쳐진다.
 */
function BettingArea({ gameData, myId }: { gameData: DoubleSidedPokerGameData; myId: string }) {
  const mine = gameData.players[myId];
  const committed = mine?.selection ?? null;
  const [branch, setBranch] = useState<DoubleSidedPokerBranch>(committed ?? 'front');
  const [showRaise, setShowRaise] = useState(false);
  const [amount, setAmount] = useState(0);
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

  /* 이미 이 라운드에서 면을 정했다면 그 갈래로 고정된다. */
  const active: DoubleSidedPokerBranch = committed ?? branch;
  const isDouble = active === 'both';
  /** 양면은 앞뒤 두 칸에 같은 칩을 내므로 실제로 나가는 칩이 두 배다. */
  const multiplier = isDouble ? 2 : 1;
  /*
    양면 선언은 한 라운드에 한 번뿐이다 — 서버는 아직 면을 안 고른 사람에게만
    double 을 받는다. 이미 양면으로 선언해 둔 뒤의 콜·레이즈는 평범한 call·raise
    이고, 두 배로 나가는 계산은 서버가 selection 을 보고 알아서 한다.
  */
  const declaringDouble = isDouble && committed == null;

  /*
    걸 칩이 없는 이월 라운드. 낼 것이 없으니 겨룰 면만 고른다. 낮은 쪽을
    고르는 것은 대개 실수라서 한 번 되묻는다 — 블러프가 통할 상대가 없는
    라운드라 일부러 낮은 면을 고를 이유가 없다.
  */
  if (gameData.selectOnly) {
    const card = mine.card;
    const submitSelect = (side: DoubleSidedPokerSide) => {
      const value = side === 'front' ? card?.front : card?.back;
      const otherValue = side === 'front' ? card?.back : card?.front;
      if (
        value != null &&
        otherValue != null &&
        value < otherValue &&
        !window.confirm(
          `${side === 'front' ? '앞면' : '뒷면'} ${value} 은 반대쪽 ${otherValue} 보다 낮습니다. 그대로 겨룹니까?`,
        )
      ) {
        return;
      }
      getSocket().emit('game:action', { type: 'select', side });
    };
    return (
      <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
        <p className="text-cdm-fg mb-2 text-center text-xs font-black">
          걸 칩이 없습니다 · 겨룰 면만 고르세요
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => submitSelect('front')}>앞면 {card?.front ?? ''}</Button>
          <Button variant="secondary" onClick={() => submitSelect('back')}>
            뒷면 {card?.back ?? ''}
          </Button>
          <Button variant="danger" onClick={() => getSocket().emit('game:action', { type: 'fold' })}>
            다이
          </Button>
        </div>
      </section>
    );
  }

  /* ── 여는 수 ── */
  if (!gameData.bettingOpened && gameData.minBet != null && gameData.maxBet != null) {
    const canOpenDouble = gameData.canDouble && gameData.maxDouble != null;
    const max = isDouble ? (gameData.maxDouble ?? 0) : gameData.maxBet;
    const stake = Math.min(max, Math.max(gameData.minBet, amount || gameData.minBet));
    const cost = stake * multiplier;
    return (
      <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
        <BranchPicker
          value={active}
          onChange={setBranch}
          doubleEnabled={canOpenDouble}
          locked={committed != null}
        />
        <div className="mb-2 flex items-center gap-3">
          <input
            className="accent-cdm-primary min-w-0 flex-1"
            type="range"
            min={gameData.minBet}
            max={Math.max(gameData.minBet, max)}
            value={stake}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
          <ChipCost total={cost} perSide={isDouble ? stake : null} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={max < gameData.minBet}
            onClick={() => {
              if (declaringDouble) {
                getSocket().emit('game:action', { type: 'double', amount: stake });
                return;
              }
              getSocket().emit('game:action', {
                type: 'bet',
                side: active as DoubleSidedPokerSide,
                amount: stake,
              });
            }}
          >
            베팅 {cost}
          </Button>
          <Button variant="danger" onClick={() => getSocket().emit('game:action', { type: 'fold' })}>
            다이
          </Button>
        </div>
        <BranchHint branch={declaringDouble ? active : 'front'} stake={stake} />
      </section>
    );
  }

  /* ── 받는 수 ── */
  const callStake = gameData.currentStake;
  const callCost = Math.max(0, callStake - mine.stake) * multiplier;
  /*
    올릴 수 있는 폭. 양면을 '지금 선언하려는' 경우에만 양면 전용 상한을 쓴다
    (앞뒤로 두 배를 내야 하고 상대가 한 면으로 받을 수 있어야 하므로 더 좁다).
    이미 양면으로 선언해 둔 뒤라면 평범한 레이즈 폭을 쓴다 — 서버가 selection
    을 보고 두 배를 계산해 준다.
  */
  const raiseMin = declaringDouble
    ? gameData.maxDouble != null && gameData.maxDouble > callStake
      ? callStake + 1
      : null
    : gameData.minRaise;
  const raiseMax = declaringDouble ? gameData.maxDouble : gameData.maxRaise;
  const raiseStake =
    raiseMin != null && raiseMax != null
      ? Math.min(raiseMax, Math.max(raiseMin, amount || raiseMin))
      : 0;
  const raiseCost = Math.max(0, raiseStake - mine.stake) * multiplier;
  const canPickDouble = gameData.canDouble && gameData.maxDouble != null;

  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
      <BranchPicker
        value={active}
        onChange={(next) => {
          setBranch(next);
          setShowRaise(false);
        }}
        doubleEnabled={canPickDouble}
        locked={committed != null}
      />

      {/*
        지금 고른 갈래로 실제로 나가는 칩. 레이즈 슬라이더를 움직이면 이 숫자도
        따라 움직여야 한다 — 예전에는 콜 기준으로 굳은 값이 남아 양면을 고른 뒤
        레이즈해도 '6(2×3)' 그대로였다.
      */}
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-cdm-fg-muted">
          {isDouble ? '두 베팅칸에 필요한 칩' : '필요한 칩'}
        </span>
        <ChipCost
          total={showRaise ? raiseCost : callCost}
          perSide={isDouble ? (showRaise ? raiseStake - mine.stake : callStake - mine.stake) : null}
        />
      </div>

      {showRaise && raiseMin != null && raiseMax != null ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              className="accent-cdm-primary min-w-0 flex-1"
              type="range"
              min={raiseMin}
              max={raiseMax}
              value={raiseStake}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
            <span className="text-cdm-fg w-12 text-right text-lg font-black tabular-nums">
              {raiseStake}
            </span>
          </div>
          <p className="text-cdm-fg-muted text-center text-[10px]">
            면별 기준 베팅 · {raiseMin}–{raiseMax}
            {isDouble ? ' · 앞뒤 두 칸에 각각 지불' : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                if (declaringDouble) {
                  setShowRaise(false);
                  getSocket().emit('game:action', { type: 'double', amount: raiseStake });
                  return;
                }
                setShowRaise(false);
                getSocket().emit('game:action', {
                  type: 'raise',
                  side: committed == null ? (active as DoubleSidedPokerSide) : undefined,
                  amount: raiseStake,
                });
              }}
            >
              레이즈 {raiseCost}
            </Button>
            <Button variant="ghost" onClick={() => setShowRaise(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => {
              if (declaringDouble) {
                getSocket().emit('game:action', { type: 'double', amount: callStake });
                return;
              }
              getSocket().emit('game:action', {
                type: 'call',
                side: committed == null ? (active as DoubleSidedPokerSide) : undefined,
              });
            }}
          >
            {callCost === 0 ? '콜 · 공개' : `콜 ${callCost}`}
          </Button>
          <Button
            variant="secondary"
            disabled={raiseMin == null || raiseMax == null}
            onClick={() => {
              setAmount(raiseMin ?? 0);
              setShowRaise(true);
            }}
          >
            레이즈
          </Button>
          <Button variant="danger" onClick={() => getSocket().emit('game:action', { type: 'fold' })}>
            다이
          </Button>
        </div>
      )}
      {/*
        양면이 무엇인지는 '고르기 전' 에만 알려 주면 된다. 이미 선언한 뒤에는
        위의 필요 칩 줄이 실제로 나가는 칩을 말해 주므로, 기준액을 다시 적으면
        그만큼이 또 나가는 것처럼 읽힌다.
      */}
      {!showRaise && declaringDouble && <BranchHint branch="both" stake={callStake} />}
    </section>
  );
}

function ResultOverlay({ gameData }: { gameData: DoubleSidedPokerGameData }) {
  const result = gameData.lastRoundResult;
  if (gameData.phase !== 'round-result' || !result) return null;
  const winnerName = result.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  /* 다이는 이긴 사람이 아니라 던진 사람을 부른다 — 인디언홀덤Q·시드섯다와 같은 표기다 */
  const foldedName = result.foldedPlayerId
    ? gameData.players[result.foldedPlayerId]?.nickname
    : null;
  const title =
    result.reason === 'tie'
      ? '같은 숫자 · 팟 이월'
      : result.reason === 'fold'
        ? `${foldedName ?? '상대'}님 다이`
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
  const playerIds = useMemo(() => (gameData ? Object.keys(gameData.players) : []), [gameData]);

  /* 라운드가 끝나 칩이 넘어갈 때 한 번. 라운드 번호로 묶어 결과 화면이 다시 그려져도 겹치지 않는다. */
  const roundEnded = gameData?.phase === 'round-result';
  const roundNumber = gameData?.round;
  useEffect(() => {
    if (roundEnded) playChipsSfx();
  }, [roundEnded, roundNumber]);

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
