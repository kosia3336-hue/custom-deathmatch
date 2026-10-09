'use client';

import type { BankPlayerInfo, BankRoundResult, BankSide } from '@/shared/types/bank-game';
import { formatKRW } from './constants';

/* ════════════════════════════════════════════════════════════
 * RoundHistoryTable — 라운드별 정산 기록
 *   · variant='mobile' (카드 리스트, 세로) / 'desktop' (행 리스트, 컴팩트)
 *   · 본인 행 indigo, 상대 행 amber, 무승부 gray
 *   · 패자 금액 공개 (rose), 승자 금액 자물쇠 (gray)
 * ════════════════════════════════════════════════════════════ */

interface Props {
  history: BankRoundResult[];
  mySide: BankSide | null;
  players: { p1: BankPlayerInfo; p2: BankPlayerInfo };
  variant?: 'mobile' | 'desktop';
}

export default function RoundHistoryTable({ history, mySide, players, variant = 'mobile' }: Props) {
  if (history.length === 0) {
    return <p className="text-[11px] text-gray-400">아직 기록이 없습니다.</p>;
  }
  return (
    <ul
      className={`bank-history ${variant === 'mobile' ? 'space-y-2 text-[11px]' : 'space-y-1 text-[11px]'}`}
    >
      {/* 다른 게임 기록과 같이 최신 라운드가 맨 위 */}
      {[...history].reverse().map((r) => (
        <RoundEntry key={r.round} r={r} mySide={mySide} players={players} variant={variant} />
      ))}
    </ul>
  );
}

function RoundEntry({
  r,
  mySide,
  players,
  variant,
}: {
  r: BankRoundResult;
  mySide: BankSide | null;
  players: { p1: BankPlayerInfo; p2: BankPlayerInfo };
  variant: 'mobile' | 'desktop';
}) {
  const isDraw = r.outcome === 'draw';
  const winColor = isDraw
    ? 'bg-gray-100 text-gray-700'
    : r.winnerSide === mySide
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-rose-100 text-rose-700';
  const winLabel = isDraw ? '무승부' : r.winnerSide === 'p1' ? 'P1 승' : 'P2 승';

  return (
    <li className="bank-history-entry overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        className={`flex items-center justify-between px-2.5 py-1.5 ${
          isDraw ? 'bg-gray-50' : r.winnerSide === mySide ? 'bg-emerald-50' : 'bg-rose-50'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-gray-700 tabular-nums">R{r.round}</span>
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${winColor}`}>
            {winLabel}
          </span>
          <span className="text-[11px] text-gray-400">
            선 {r.firstSide === 'p1' ? players.p1.nickname : players.p2.nickname}
          </span>
        </div>
        <span className="text-[11px] text-gray-500 tabular-nums">
          {r.scoreAfter.p1} : {r.scoreAfter.p2}
        </span>
      </div>
      <div className={variant === 'mobile' ? 'space-y-1 px-2.5 py-2' : 'space-y-0.5 px-2.5 py-1.5'}>
        <PlayerRow
          side="p1"
          isMe={mySide === 'p1'}
          isFirst={r.firstSide === 'p1'}
          isWinner={r.winnerSide === 'p1'}
          nickname={players.p1.nickname}
          count={r.firstSide === 'p1' ? r.firstCount : r.secondCount}
          amount={r.firstSide === 'p1' ? r.firstAmount : r.secondAmount}
          auto={r.firstSide === 'p1' ? r.firstAuto : r.secondAuto}
        />
        <PlayerRow
          side="p2"
          isMe={mySide === 'p2'}
          isFirst={r.firstSide === 'p2'}
          isWinner={r.winnerSide === 'p2'}
          nickname={players.p2.nickname}
          count={r.firstSide === 'p2' ? r.firstCount : r.secondCount}
          amount={r.firstSide === 'p2' ? r.firstAmount : r.secondAmount}
          auto={r.firstSide === 'p2' ? r.firstAuto : r.secondAuto}
        />
      </div>
    </li>
  );
}

function PlayerRow({
  isMe,
  nickname,
  count,
  amount,
}: {
  side: BankSide;
  isMe: boolean;
  isFirst: boolean;
  isWinner: boolean;
  nickname: string;
  count: number;
  amount: number | null;
  auto: boolean;
}) {
  const rowBg = isMe ? 'bg-indigo-50' : 'bg-amber-50';
  const labelColor = isMe ? 'text-indigo-700' : 'text-amber-700';
  return (
    <div
      className={`bank-history-player bank-score-card--${isMe ? 'player' : 'opponent'} flex items-center gap-1.5 rounded-lg px-2 py-1 ${rowBg}`}
    >
      <span className={`min-w-0 flex-1 truncate font-bold ${labelColor}`}>
        {isMe ? '나' : nickname}
      </span>
      <span className="shrink-0 font-semibold text-gray-700 tabular-nums">{count}장</span>
      <span className="ml-auto shrink-0 tabular-nums">
        {amount == null ? (
          <span className="text-gray-400" />
        ) : (
          <span className="font-extrabold text-rose-700">{formatKRW(amount)}원</span>
        )}
      </span>
    </div>
  );
}
