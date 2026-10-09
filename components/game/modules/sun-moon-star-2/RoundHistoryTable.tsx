'use client';

import { opponentDisplayName } from '@/lib/anonymousOpponents';
import type {
  SMS2MarkId,
  SMS2PlayerPublic,
  SMS2RoundRecord,
  SMS2Side,
} from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, sumBet } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';

/* ════════════════════════════════════════════════════════════
 * RoundHistoryTable — 라운드별 상세 기록
 *   · 점등 표식, 선/후, 단계 변화
 *   · 표식별 베팅 (양측 공개)
 *   · 칩 변화 + 잔량
 *   · 내 빛가루 제출 (본인만 — 상대 것은 서버에서 0 마스킹)
 * ════════════════════════════════════════════════════════════ */

interface Props {
  history: SMS2RoundRecord[];
  mySide: SMS2Side | null;
  players: { p1: SMS2PlayerPublic; p2: SMS2PlayerPublic };
}

export default function RoundHistoryTable({ history, mySide, players }: Props) {
  if (history.length === 0) {
    return <p className="text-[11px] text-gray-400">아직 기록이 없습니다.</p>;
  }
  const nick = (side: SMS2Side) =>
    mySide
      ? side === mySide
        ? '나'
        : opponentDisplayName(players[side].nickname)
      : players[side].nickname;

  return (
    <ul className="space-y-2 text-[11px]">
      {/* 다른 게임 기록과 같이 최신 라운드가 맨 위 */}
      {[...history].reverse().map((r) => {
        const oppSide: SMS2Side = mySide === 'p1' ? 'p2' : 'p1';
        const myDelta = mySide ? r.chipDelta[mySide] : null;
        const oppDelta = mySide ? r.chipDelta[oppSide] : null;
        const myAfter = mySide ? r.chipAfter[mySide] : null;
        const oppAfter = mySide ? r.chipAfter[oppSide] : null;

        /* 단계 변화 */
        const myStageDiff = mySide ? r.stageBefore[mySide] - r.stageAfter[mySide] : null;
        const oppStageDiff = mySide ? r.stageBefore[oppSide] - r.stageAfter[oppSide] : null;

        /* 내 빛가루 제출 (서버가 상대 것은 0으로 마스킹하므로 내 것만 의미 있음) */
        const myPowder = mySide ? r.powderSubmission[mySide] : null;
        const myPowderTotal = myPowder ? myPowder.sun + myPowder.moon + myPowder.star : 0;

        const s = MARK_STYLES[r.litMark];

        return (
          <li
            key={`${r.round}-${r.firstPlayerSide}`}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            {/* 헤더 */}
            <div className={`flex items-center justify-between px-2.5 py-1.5 ${s.bgLit}`}>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-600">R{r.round}</span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${s.textLit}`}>
                  {s.icon} {s.label} 점등
                </span>
              </div>
              <span className="text-[11px] text-gray-500">선 {nick(r.firstPlayerSide)}</span>
            </div>

            <div className="space-y-1.5 px-2.5 py-2">
              {/* 단계 변화 */}
              {mySide && (
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="shrink-0 text-gray-400">단계</span>
                  <StageDiff label="나" diff={myStageDiff} />
                  <span className="text-gray-300">/</span>
                  <StageDiff
                    label={opponentDisplayName(players[oppSide].nickname)}
                    diff={oppStageDiff}
                  />
                </div>
              )}

              {/* 표식별 베팅 */}
              <div className="space-y-0.5">
                {mySide && (
                  <BetRow
                    label="나"
                    bet={r.bets[mySide]}
                    delta={myDelta!}
                    after={myAfter!}
                    litMark={r.litMark}
                    isMe
                  />
                )}
                <BetRow
                  label={
                    mySide ? opponentDisplayName(players[oppSide].nickname) : players.p1.nickname
                  }
                  bet={mySide ? r.bets[oppSide] : r.bets.p1}
                  delta={oppDelta ?? r.chipDelta.p1}
                  after={oppAfter ?? r.chipAfter.p1}
                  litMark={r.litMark}
                  isMe={false}
                />
                {!mySide && (
                  <BetRow
                    label={players.p2.nickname}
                    bet={r.bets.p2}
                    delta={r.chipDelta.p2}
                    after={r.chipAfter.p2}
                    litMark={r.litMark}
                    isMe={false}
                  />
                )}
              </div>

              {/* 내 빛가루 제출 (본인만) */}
              {myPowder && myPowderTotal > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <span className="shrink-0">내 분배</span>
                  {MARK_IDS.map((m) =>
                    myPowder[m] > 0 ? (
                      <span key={m} className="tabular-nums">
                        {MARK_STYLES[m].icon}
                        {myPowder[m]}g
                      </span>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── 서브 컴포넌트 ── */

function StageDiff({ label, diff }: { label: string; diff: number | null }) {
  if (diff === null) return null;
  return (
    <span
      className={`font-semibold tabular-nums ${diff > 0 ? 'text-orange-600' : 'text-gray-400'}`}
    >
      {label} {diff > 0 ? `${diff}칸↓` : '유지'}
    </span>
  );
}

function BetRow({
  label,
  bet,
  delta,
  after,
  litMark,
  isMe,
}: {
  label: string;
  bet: { sun: number; moon: number; star: number };
  delta: number;
  after: number;
  litMark: SMS2MarkId;
  isMe: boolean;
}) {
  const total = sumBet(bet);
  const isPos = delta > 0;
  const isNeg = delta < 0;
  const rowBg = isMe ? 'bg-indigo-50' : 'bg-amber-50';
  const labelColor = isMe ? 'text-indigo-700' : 'text-amber-700';
  const deltaColor = isPos ? 'text-emerald-700' : isNeg ? 'text-rose-600' : 'text-gray-500';

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${rowBg}`}>
      <span className={`w-10 shrink-0 truncate font-bold ${labelColor}`}>{label}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        {MARK_IDS.map((m) => {
          const ms = MARK_STYLES[m];
          const v = bet[m];
          const isLit = m === litMark;
          return (
            <span
              key={m}
              className={`rounded px-1 py-0.5 font-semibold tabular-nums ${
                v > 0
                  ? isLit
                    ? `${ms.chipSelf} ring-1 ${ms.ringLit}`
                    : ms.chipSelf
                  : 'text-gray-300'
              }`}
            >
              {ms.icon}
              {v}
            </span>
          );
        })}
      </div>
      <span className="shrink-0 text-gray-400 tabular-nums">{total}칩</span>
      <span className={`ml-auto shrink-0 font-extrabold tabular-nums ${deltaColor}`}>
        {isPos ? `+${delta}` : `${delta}`}
        <span className="ml-0.5 font-normal text-gray-400">({after})</span>
      </span>
    </div>
  );
}
