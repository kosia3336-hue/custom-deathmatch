'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import Button from '@/components/ui/Button';
import type {
  DoubleSidedPokerGameData,
  DoubleSidedPokerSide,
} from '@/shared/types/double-sided-poker';
import { useState } from 'react';
import { BranchHint } from './BranchHint';
import { BranchPicker } from './BranchPicker';
import { ChipCost } from './ChipCost';
import { DoubleSidedPokerBranch } from './presentation';

export function BettingArea({
  gameData,
  myId,
}: {
  gameData: DoubleSidedPokerGameData;
  myId: string;
}) {
  const sendAction = useGameAction();
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
      sendAction({ type: 'select', side });
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
          <Button variant="danger" onClick={() => sendAction({ type: 'fold' })}>
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
                sendAction({ type: 'double', amount: stake });
                return;
              }
              sendAction({
                type: 'bet',
                side: active as DoubleSidedPokerSide,
                amount: stake,
              });
            }}
          >
            베팅 {cost}
          </Button>
          <Button variant="danger" onClick={() => sendAction({ type: 'fold' })}>
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
          <p className="text-cdm-fg-muted text-center text-[11px]">
            면별 기준 베팅 · {raiseMin}–{raiseMax}
            {isDouble ? ' · 앞뒤 두 칸에 각각 지불' : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                if (declaringDouble) {
                  setShowRaise(false);
                  sendAction({ type: 'double', amount: raiseStake });
                  return;
                }
                setShowRaise(false);
                sendAction({
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
                sendAction({ type: 'double', amount: callStake });
                return;
              }
              sendAction({
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
          <Button variant="danger" onClick={() => sendAction({ type: 'fold' })}>
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
