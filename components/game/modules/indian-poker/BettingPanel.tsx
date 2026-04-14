'use client';

import { useState } from 'react';
import { getSocket } from '@/lib/socket';
import type { IPBettingAction, IPPlayerInfo } from '@/shared/types/indian-poker';
import Button from '@/components/ui/Button';
import {
  formatBettingVerb,
  getLastActionByPlayer,
} from './constants';

interface BettingPanelProps {
  isMyTurn: boolean;
  canCheck: boolean;
  myPlayer: IPPlayerInfo;
  opponentPlayer: IPPlayerInfo | undefined;
  pot: number;
  isSpectator: boolean;
  currentRoundActions: IPBettingAction[];
  players: Record<string, IPPlayerInfo>;
  opponentId: string | undefined;
  myId: string | undefined;
}

function BettingInfoRow({
  pot,
  callCost,
  centerLabel,
}: {
  pot: number;
  callCost: number;
  centerLabel: string;
}) {
  return (
    <>
      {/* 모바일: 팟/콜 한 줄 + 가운데 상대 선택 */}
      <div className="flex flex-col gap-1 lg:hidden">
        <div className="flex justify-between text-sm text-gray-500">
          <span>
            팟: <strong className="text-gray-900">{pot}</strong>
          </span>
          {callCost > 0 && (
            <span>
              콜 비용: <strong className="text-gray-900">{callCost}</strong>
            </span>
          )}
        </div>
        <p className="text-center text-sm font-medium text-gray-700">{centerLabel}</p>
      </div>

      {/* 데스크탑: 3열 그리드로 가운데 정렬 유지 */}
      <div className="hidden text-sm text-gray-500 lg:grid lg:w-full lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-3 lg:text-base">
        <span className="justify-self-start text-left">
          팟: <strong className="text-gray-900">{pot}</strong>
        </span>
        <span className="max-w-56 truncate text-center font-medium text-gray-700">
          {centerLabel}
        </span>
        <span className="justify-self-end text-right tabular-nums">
          {callCost > 0 ? (
            <>
              콜 비용: <strong className="text-gray-900">{callCost}</strong>
            </>
          ) : (
            <span className="invisible select-none" aria-hidden>
              콜 비용: 0
            </span>
          )}
        </span>
      </div>
    </>
  );
}

export default function BettingPanel({
  isMyTurn,
  canCheck,
  myPlayer,
  opponentPlayer,
  pot,
  isSpectator,
  currentRoundActions,
  players,
  opponentId,
  myId,
}: BettingPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState<number | null>(null);
  const [showRaise, setShowRaise] = useState(false);

  const opponentNick = opponentId ? players[opponentId]?.nickname ?? '상대' : '상대';
  const lastOpponent = opponentId ? getLastActionByPlayer(currentRoundActions, opponentId) : undefined;
  const opponentLine = `${opponentNick} · ${formatBettingVerb(lastOpponent)}`;

  const lastMine = myId ? getLastActionByPlayer(currentRoundActions, myId) : undefined;
  const myLine = myId ? `나 · ${formatBettingVerb(lastMine)}` : '';

  // 베팅 계산 (관전자 뷰에서도 필요하므로 early return 전에 수행)
  const opponentRoundBet = opponentPlayer?.roundBet ?? 0;
  const opponentChips = opponentPlayer?.chips ?? 0;
  const callCost = opponentRoundBet - myPlayer.roundBet;
  // Bug fix: 선플레이어 체크 후 callCost=0인 경우에도 콜 가능해야 함 (쇼다운으로 진행)
  const canCall = callCost >= 0 && callCost <= myPlayer.chips;

  const myMaxRaise = myPlayer.roundBet + myPlayer.chips;
  const opponentMaxCall = opponentRoundBet + opponentChips;
  const minRaise = opponentRoundBet + 1;
  const maxRaise = Math.min(myMaxRaise, opponentMaxCall);
  const canRaise = minRaise <= maxRaise;
  const isAllIn = maxRaise === myMaxRaise && myMaxRaise === opponentMaxCall;

  const currentRaiseAmount = raiseAmount ?? minRaise;

  // 관전자: 베팅 현황 표시 (버튼 없음)
  if (isSpectator) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <BettingInfoRow pot={pot} callCost={callCost} centerLabel={opponentLine} />
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          {currentRoundActions.length > 0 ? (
            <div className="space-y-0.5">
              {currentRoundActions.map((a, i) => (
                <p key={i} className="text-xs text-gray-500">
                  {players[a.playerId]?.nickname}: {formatBettingVerb(a)}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-gray-400">아직 베팅 없음</p>
          )}
        </div>
        <p className="text-center text-xs text-gray-400">관전 중</p>
      </div>
    );
  }

  // 상대 턴 대기
  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="animate-pulse text-gray-400">●  ●  ●</div>
        <p className="text-sm text-gray-500 lg:text-base">상대의 베팅을 기다리는 중...</p>
        {myLine && lastMine && (
          <p className="text-center text-xs text-gray-600 lg:text-sm">{myLine}</p>
        )}
      </div>
    );
  }

  const handleAction = (type: string, amount?: number) => {
    const data: Record<string, unknown> = { type };
    if (amount !== undefined) data.amount = amount;
    getSocket().emit('game:action', data);
    setShowRaise(false);
    setRaiseAmount(null);
  };

  const openRaise = () => {
    setRaiseAmount(minRaise);
    setShowRaise(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <BettingInfoRow pot={pot} callCost={callCost} centerLabel={opponentLine} />

      {/* 레이즈 패널 */}
      {showRaise ? (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={minRaise}
              max={maxRaise}
              value={currentRaiseAmount}
              onChange={(e) => setRaiseAmount(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min={minRaise}
              max={maxRaise}
              value={currentRaiseAmount}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= minRaise && v <= maxRaise) setRaiseAmount(v);
              }}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleAction('raise', currentRaiseAmount)} className="flex-1">
              레이즈 ({currentRaiseAmount})
            </Button>
            {/* 올인 버튼 — 레이즈 패널 내에서도 표시 */}
            {canRaise && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleAction('raise', maxRaise)}
                className="whitespace-nowrap font-semibold"
              >
                올인 ({maxRaise})
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => { setShowRaise(false); setRaiseAmount(null); }}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {canCheck && (
            <Button size="sm" variant="secondary" onClick={() => handleAction('check')}>
              체크
            </Button>
          )}
          {!canCheck && (
            <Button
              size="sm"
              onClick={() => handleAction('call')}
              disabled={!canCall}
            >
              {callCost > 0 ? `콜 (${callCost})` : '콜'}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={openRaise}
            disabled={!canRaise}
          >
            레이즈
          </Button>
          {/* 올인 버튼 */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAction('raise', maxRaise)}
            disabled={!canRaise}
            className="font-semibold text-amber-700 ring-1 ring-amber-300 hover:bg-amber-50 disabled:ring-0"
          >
            {isAllIn ? '올인' : `올인 (${maxRaise})`}
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleAction('die')}>
            다이
          </Button>
        </div>
      )}
    </div>
  );
}
