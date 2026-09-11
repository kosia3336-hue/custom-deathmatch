'use client';

import type { BRPSPlayerInfo, BRPSRoundRecord } from '@/shared/types/betting-rps';
import { RESULT_LABELS, RESULT_COLORS, OUTCOME_LABELS, OUTCOME_COLORS } from './constants';

/*
  이 표는 '판 정보'(짙은 잉크 칸) 안에서만 쓴다. 공용 색표는 밝은 공개 화면·기록
  보기용 -600 이라 잉크 바탕에서 묻힌다. 공용 값은 두고 여기서만 밝은 쪽으로 옮긴다.
  (Tailwind 가 찾을 수 있게 클래스 이름을 문자열 그대로 적는다.)
*/
const INK_TONE: Record<string, string> = {
  'text-blue-600': 'text-blue-300',
  'text-amber-600': 'text-amber-300',
  'text-red-600': 'text-red-300',
  'text-emerald-600': 'text-emerald-300',
};
const ink = (cls: string) => INK_TONE[cls] ?? cls;

interface Props {
  history: BRPSRoundRecord[];
  players: Record<string, BRPSPlayerInfo>;
  myId?: string;
  compact?: boolean;
}

export default function RoundHistoryTable({ history, players, myId, compact }: Props) {
  if (history.length === 0) return null;

  const textSz = compact ? 'text-[10px]' : 'text-[11px]';
  const headerSz = compact ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="w-full overflow-hidden">
      {/* Header */}
      <div className={`grid grid-cols-[18px_28px_1fr_auto] items-center gap-x-1.5 pb-0.5 ${headerSz} font-medium text-cdm-ink-fg-muted`}>
        <span>#</span>
        <span>역할</span>
        <span>선택 / 예측</span>
        <span className="text-right">칩</span>
      </div>

      <div className="border-t border-cdm-ink-border pt-1 space-y-1.5">
        {history.map((r) => {
          const pEntries = Object.entries(r.players);
          const matchEntry = pEntries.find(([, p]) => p.role === 'match');
          const betEntry = pEntries.find(([, p]) => p.role === 'bet');

          const matchPlayerId = matchEntry?.[0];
          const betPlayerId = betEntry?.[0];

          const matchResult = matchEntry?.[1].matchResult;
          const matchChipChange = matchEntry?.[1].chipChange ?? 0;

          const prediction = betEntry?.[1].prediction;
          const outcome = betEntry?.[1].betOutcome;
          const betChipChange = betEntry?.[1].chipChange ?? 0;

          const isMatchMe = matchPlayerId === myId;
          const isBetMe = betPlayerId === myId;

          const matchNick = matchPlayerId
            ? (myId ? (isMatchMe ? '나' : (players[matchPlayerId]?.nickname ?? '?')) : (players[matchPlayerId]?.nickname ?? '?'))
            : '—';
          const betNick = betPlayerId
            ? (myId ? (isBetMe ? '나' : (players[betPlayerId]?.nickname ?? '?')) : (players[betPlayerId]?.nickname ?? '?'))
            : '—';

          return (
            <div key={r.round} className={`${textSz} space-y-0.5`}>
              {/* Match player row */}
              <div className="grid grid-cols-[18px_28px_1fr_auto] items-baseline gap-x-1.5">
                <span className="font-bold text-cdm-ink-fg-muted">{r.round}</span>
                <span className="text-cdm-ink-fg-muted">승부</span>
                <span className={`truncate font-medium ${isMatchMe ? 'text-indigo-300' : 'text-cdm-ink-fg-muted'}`}>
                  {matchNick}&nbsp;
                  <span className={`font-bold ${matchResult ? ink(RESULT_COLORS[matchResult]) : 'text-white/30'}`}>
                    {matchResult ? RESULT_LABELS[matchResult] : '—'}
                  </span>
                </span>
                <span className={`text-right tabular-nums font-semibold ${
                  matchChipChange > 0 ? 'text-emerald-300' : 'text-white/30'
                }`}>
                  {matchChipChange > 0 ? `+${matchChipChange}` : '—'}
                </span>
              </div>

              {/* Bet player row */}
              <div className="grid grid-cols-[18px_28px_1fr_auto] items-baseline gap-x-1.5">
                <span />
                <span className="text-cdm-ink-fg-muted">베팅</span>
                <span className={`truncate font-medium ${isBetMe ? 'text-indigo-300' : 'text-cdm-ink-fg-muted'}`}>
                  {betNick}&nbsp;
                  <span className={`font-bold ${prediction ? ink(RESULT_COLORS[prediction]) : 'text-white/30'}`}>
                    {prediction ? RESULT_LABELS[prediction] : '—'}
                  </span>
                  {outcome && (
                    <span className={`ml-1 font-semibold ${ink(OUTCOME_COLORS[outcome])}`}>
                      {OUTCOME_LABELS[outcome]}
                    </span>
                  )}
                </span>
                <span className={`text-right tabular-nums font-semibold ${
                  betChipChange > 0 ? 'text-emerald-300' : betChipChange < 0 ? 'text-red-400' : 'text-cdm-ink-fg-muted'
                }`}>
                  {betChipChange > 0 ? '+' : ''}{betChipChange !== 0 ? betChipChange : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
