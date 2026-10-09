'use client';

import type { SMS2PlayerPublic, SMS2ResolveStep, SMS2Side } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, sms2RevealRowDelay } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';
import styles from './mark-reveal.module.css';

interface Props {
  resolveSteps: SMS2ResolveStep[] | null;
  round: number;
  players: { p1: SMS2PlayerPublic; p2: SMS2PlayerPublic };
  mySide: SMS2Side | null;
  dalmaji?: boolean;
  /** 정산 완료/재접속은 연출을 다시 기다리지 않고 전체 표시 */
  complete?: boolean;
}

/** 한 결과판에 해·달·별 정산, 최종 칩, 소멸 내역을 순서대로 쌓는다. */
export default function MarkRevealPanel({
  resolveSteps,
  round,
  players,
  mySide,
  dalmaji = false,
  complete = false,
}: Props) {
  if (!resolveSteps?.length) return null;
  const bets = resolveSteps.find((step) => step.type === 'betReveal');
  const decision = resolveSteps.find((step) => step.type === 'litDecision');
  const summary = resolveSteps.find((step) => step.type === 'roundSummary');
  const burn = resolveSteps.find((step) => step.type === 'powderBurn');
  const sides: SMS2Side[] = mySide === 'p2' ? ['p2', 'p1'] : ['p1', 'p2'];
  const nick = (side: SMS2Side) => (side === mySide ? '나' : players[side].nickname);
  const betFor = (side: SMS2Side) =>
    bets && (side === bets.firstSide ? bets.firstBet : bets.secondBet);
  const lit = decision ? MARK_STYLES[decision.litMark] : null;

  return (
    <section
      key={round}
      aria-label={`R${round} 라운드 결과`}
      className={`${styles.panel} ${dalmaji ? styles.dalmaji : ''} ${complete ? styles.complete : ''} w-full space-y-2 rounded-xl border p-3 text-xs shadow-sm`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <h3 className={`${styles.title} font-bold`}>R{round} 라운드 결과</h3>
        {lit && (
          <span
            className={`${styles.badge} rounded px-2 py-1 font-bold ${dalmaji ? '' : `${lit.bgLit} ${lit.textLit}`}`}
          >
            {lit.icon} {lit.label} 점등{decision?.tieBreak && ' · 동률 우선순위'}
          </span>
        )}
      </div>
      <table className="w-full table-fixed text-center tabular-nums">
        <caption className="sr-only">표식별 베팅과 환급·몰수 내역</caption>
        <colgroup>
          <col className="w-14" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr className={`${styles.header} border-b`}>
            <th scope="col" className={`${styles.muted} py-1 font-medium`}>
              표식
            </th>
            {sides.map((side) => (
              <th key={side} scope="col" className="px-1 py-1">
                <span className="block break-words">
                  {bets && (side === bets.firstSide ? '선' : '후')} {nick(side)}
                </span>
                <span className={`${styles.muted} text-[11px] font-normal`}>베팅 → 정산</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MARK_IDS.map((mark, index) => {
            const style = MARK_STYLES[mark];
            return (
              <tr
                key={mark}
                data-result-row={mark}
                style={{ animationDelay: `${sms2RevealRowDelay(index)}ms` }}
                className={`${styles.reveal} ${decision?.litMark === mark ? `${styles.litRow} ${dalmaji ? '' : style.bgSoft}` : ''}`}
              >
                <th scope="row" className="px-1 py-1.5 font-medium">
                  {style.icon} {style.label}
                </th>
                {sides.map((side) => {
                  const staked = betFor(side)?.[mark] ?? 0;
                  const payout = resolveSteps.find(
                    (step) => step.type === 'payout' && step.side === side && step.mark === mark,
                  );
                  const forfeit = resolveSteps.find(
                    (step) => step.type === 'forfeit' && step.side === side && step.mark === mark,
                  );
                  return (
                    <td key={side} className="px-1 py-1.5">
                      {staked} <span className={styles.muted}>→</span>{' '}
                      {payout?.type === 'payout' ? (
                        <span className={`${styles.gain} font-bold`}>{payout.returned} 환급</span>
                      ) : forfeit ? (
                        <span className={`${styles.loss} font-bold`}>{staked} 몰수</span>
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {summary && (
            <tr
              data-result-row="summary"
              style={{ animationDelay: `${sms2RevealRowDelay(3)}ms` }}
              className={`${styles.reveal} ${styles.summary} border-t`}
            >
              <th scope="row" className="py-2 font-medium">
                최종 칩
              </th>
              {sides.map((side) => {
                const delta = summary.chipDelta[side];
                return (
                  <td key={side} className="px-1 py-2 font-bold">
                    {summary.chipAfter[side] - delta}{' '}
                    <span className={`${styles.muted} font-normal`}>→</span>{' '}
                    {summary.chipAfter[side]}
                    <span
                      className={`ml-1 ${delta > 0 ? styles.gain : delta < 0 ? styles.loss : styles.muted}`}
                    >
                      ({delta > 0 ? '+' : ''}
                      {delta})
                    </span>
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
      {burn && (
        <p
          data-result-row="burn"
          style={{ animationDelay: `${sms2RevealRowDelay(4)}ms` }}
          className={`${styles.reveal} ${styles.burn} rounded px-2 py-1.5 text-[11px]`}
        >
          {MARK_STYLES[burn.mark].icon} {MARK_STYLES[burn.mark].label}의 빛가루 소멸
        </p>
      )}
    </section>
  );
}
