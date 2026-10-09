'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import { PokerBettingPanel } from '@/components/game/poker/PokerBettingPanel';
import { PokerBettingSummary } from '@/components/game/poker/PokerBettingSummary';
import { PokerAmountInput } from '@/components/game/poker/PokerAmountInput';
import type {
  DoubleSidedPokerGameData,
  DoubleSidedPokerSide,
} from '@/shared/types/double-sided-poker';
import { useState } from 'react';
import { BranchHint } from './BranchHint';
import { BranchPicker } from './BranchPicker';
import { BRANCH_LABEL, type DoubleSidedPokerBranch } from './presentation';

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
  const fold = () => sendAction({ type: 'fold' });

  if (!myTurn) {
    const current = gameData.currentTurnId ? gameData.players[gameData.currentTurnId] : null;
    return (
      <PokerBettingPanel>
        <PokerBettingSummary
          chips={mine?.chips ?? current?.chips ?? 0}
          pot={gameData.pot}
          callCost={mine ? mine.frontBet + mine.backBet : 0}
          costLabel="내 베팅"
          status={mine ? '상대의 선택을 기다리고 있습니다.' : '관전 중'}
        />
      </PokerBettingPanel>
    );
  }

  // 선택한 면은 이 라운드에서 고정. 양면의 실제 추가 지출은 면별 금액의 두 배다.
  const active: DoubleSidedPokerBranch = committed ?? branch;
  const isDouble = active === 'both';
  const multiplier = isDouble ? 2 : 1;
  const declaringDouble = isDouble && committed == null;
  const summary = (cost: number, perSide: number, label = '필요한 칩') => (
    <PokerBettingSummary
      chips={mine.chips}
      pot={gameData.pot}
      callCost={cost}
      costLabel={label}
      status={`${BRANCH_LABEL[active]} · ${isDouble ? `앞뒤 각각 ${perSide}칩 · 총 ${cost}칩` : `추가 ${cost}칩`}`}
    />
  );
  const picker = (doubleEnabled: boolean) => (
    <BranchPicker
      value={active}
      onChange={(next) => {
        setBranch(next);
        setShowRaise(false);
      }}
      doubleEnabled={doubleEnabled}
      locked={committed != null}
    />
  );

  // 이월 라운드의 면 선택 및 낮은 면 확인 규칙은 유지한다.
  if (gameData.selectOnly) {
    const card = mine.card;
    const select = (side: DoubleSidedPokerSide) => {
      const value = side === 'front' ? card?.front : card?.back;
      const other = side === 'front' ? card?.back : card?.front;
      if (
        value != null &&
        other != null &&
        value < other &&
        !window.confirm(
          `${side === 'front' ? '앞면' : '뒷면'} ${value} 은 반대쪽 ${other} 보다 낮습니다. 그대로 겨룹니까?`,
        )
      )
        return;
      sendAction({ type: 'select', side });
    };
    return (
      <PokerBettingPanel>
        <PokerBettingSummary
          chips={mine.chips}
          pot={gameData.pot}
          callCost={0}
          status="걸 칩이 없습니다 · 겨룰 면만 고르세요"
        />
        <div className="ip-betting-actions">
          <button
            type="button"
            className="ip-betting-action ip-betting-primary"
            onClick={() => select('front')}
          >
            <strong>앞면</strong>
            <span>{card?.front ?? '비공개'}</span>
          </button>
          <button
            type="button"
            className="ip-betting-action ip-betting-raise"
            onClick={() => select('back')}
          >
            <strong>뒷면</strong>
            <span>{card?.back ?? '비공개'}</span>
          </button>
          <button type="button" className="ip-betting-action ip-betting-fold" onClick={fold}>
            <strong>다이</strong>
            <span>이번 판 포기</span>
          </button>
        </div>
      </PokerBettingPanel>
    );
  }

  if (!gameData.bettingOpened && gameData.minBet != null && gameData.maxBet != null) {
    const max = isDouble ? (gameData.maxDouble ?? 0) : gameData.maxBet;
    const stake = Math.min(max, Math.max(gameData.minBet, amount || gameData.minBet));
    return (
      <PokerBettingPanel>
        {summary(stake * multiplier, stake, '베팅 칩')}
        {picker(gameData.canDouble && gameData.maxDouble != null)}
        <PokerAmountInput
          key={`${active}:bet`}
          title="베팅"
          min={gameData.minBet}
          max={Math.max(gameData.minBet, max)}
          initialAmount={stake}
          enabled={max >= gameData.minBet}
          onPreview={setAmount}
          onCancel={fold}
          cancelLabel="다이"
          cancelClassName="ip-betting-fold"
          cancelPosition="right"
          confirmLabel={(value) => `${value * multiplier}칩 베팅`}
          onConfirm={(value) =>
            sendAction(
              declaringDouble
                ? { type: 'double', amount: value }
                : { type: 'bet', side: active as DoubleSidedPokerSide, amount: value },
            )
          }
        />
        <BranchHint branch={declaringDouble ? active : 'front'} stake={stake} />
      </PokerBettingPanel>
    );
  }

  const callStake = gameData.currentStake;
  const callCost = Math.max(0, callStake - mine.stake) * multiplier;
  // 양면을 지금 선언할 때만 양면 상한을 사용한다. 선언 후 레이즈는 기존 서버 한도다.
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
  const raising = showRaise && raiseMin != null && raiseMax != null;
  const costPerSide = Math.max(0, (raising ? raiseStake : callStake) - mine.stake);

  return (
    <PokerBettingPanel>
      {summary(costPerSide * multiplier, costPerSide, raising ? '레이즈 칩' : '콜 비용')}
      {picker(gameData.canDouble && gameData.maxDouble != null)}
      {raising ? (
        <PokerAmountInput
          key={`${active}:raise`}
          title="레이즈"
          min={raiseMin}
          max={raiseMax}
          initialAmount={raiseStake}
          onPreview={setAmount}
          onCancel={() => setShowRaise(false)}
          confirmLabel={(value) => `${Math.max(0, value - mine.stake) * multiplier}칩 레이즈`}
          onConfirm={(value) => {
            setShowRaise(false);
            sendAction(
              declaringDouble
                ? { type: 'double', amount: value }
                : {
                    type: 'raise',
                    side: committed == null ? (active as DoubleSidedPokerSide) : undefined,
                    amount: value,
                  },
            );
          }}
        />
      ) : (
        <div className="ip-betting-actions">
          <button
            type="button"
            className="ip-betting-action ip-betting-primary"
            disabled={callCost > mine.chips}
            onClick={() =>
              sendAction(
                declaringDouble
                  ? { type: 'double', amount: callStake }
                  : {
                      type: 'call',
                      side: committed == null ? (active as DoubleSidedPokerSide) : undefined,
                    },
              )
            }
          >
            <strong>콜</strong>
            <span>{callCost === 0 ? '카드 공개' : `${callCost}칩`}</span>
          </button>
          <button
            type="button"
            className="ip-betting-action ip-betting-raise"
            disabled={raiseMin == null || raiseMax == null}
            onClick={() => {
              setAmount(raiseMin ?? 0);
              setShowRaise(true);
            }}
          >
            <strong>레이즈</strong>
            <span>금액 선택</span>
          </button>
          <button type="button" className="ip-betting-action ip-betting-fold" onClick={fold}>
            <strong>다이</strong>
            <span>이번 판 포기</span>
          </button>
        </div>
      )}
      {!raising && declaringDouble && <BranchHint branch="both" stake={callStake} />}
    </PokerBettingPanel>
  );
}
