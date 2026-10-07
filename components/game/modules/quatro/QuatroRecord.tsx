'use client';

import { opponentDisplayName } from '@/lib/anonymousOpponents';
import { cn } from '@/lib/utils';
import { QUATRO_MAX_MULLIGANS, type QuatroVisibleLogEntry } from '@/shared/types/quatro';
import type { ReactNode } from 'react';
import QuatroMiniCard from './QuatroMiniCard';

const vpLabel = (index: number) => String.fromCharCode(65 + index);

/**
 * 콰트로 진행 기록 — 모바일 하단 기록 탭 / PC 독립 도킹 창.
 * 카드 분배 → 멀리건(누가 몇 번째로 썼는지, 선/후) → 라운드별 오픈·교환·스탑 순서로 쌓인다.
 * 교환으로 받은 카드는 서버가 받은 사람에게만 보내고, 상대·관전자에게는 뒷면(null)이다.
 */
export default function QuatroRecord({
  log,
  firstByRound,
  players,
  myId,
  round,
}: {
  log: QuatroVisibleLogEntry[];
  firstByRound: Record<number, string>;
  players: Record<string, { nickname: string }>;
  myId: string | null | undefined;
  round: number;
}) {
  // 플레이어에게 익명 상대(???)는 '상대' 로 — 관전자는 두 사람 모두 ??? 일 수 있어 그대로 둔다
  const isPlayer = Boolean(myId && players[myId]);
  const name = (id: string | undefined) => {
    if (!id) return '?';
    const nickname = players[id]?.nickname;
    if (id === myId) return `${nickname ?? '?'} (나)`;
    return isPlayer ? opponentDisplayName(nickname) : (nickname ?? '?');
  };
  const seatOf = (r: number, id: string) =>
    firstByRound[r] ? (firstByRound[r] === id ? '선' : '후') : null;

  // 멀리건은 사람마다 몇 번째로 썼는지 함께 보여 준다
  const mulliganRows = (() => {
    const used: Record<string, number> = {};
    return log
      .filter((e) => e.type === 'mulligan')
      .map((e) => {
        const nth =
          e.type === 'mulligan' && e.used ? (used[e.actorId] = (used[e.actorId] ?? 0) + 1) : 0;
        return { entry: e, nth };
      });
  })();

  const roundNums = Object.keys(firstByRound)
    .map(Number)
    .filter((r) => r > 0)
    .sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-2.5 text-xs">
      {roundNums.map((r) => {
        const entries = log.filter((e) => e.round === r && e.type !== 'mulligan');
        return (
          <Block key={r} title={`라운드 ${r}`} meta={`선 ${name(firstByRound[r])}`}>
            {entries.length === 0 ? (
              <Empty>{r === round ? '진행 중' : '기록 없음'}</Empty>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {entries.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-1.5">
                    <SeatBadge seat={seatOf(r, e.actorId)} />
                    <span className="text-cdm-fg font-semibold">{name(e.actorId)}</span>
                    {e.type === 'open' && (
                      <>
                        <span className="text-cdm-fg-muted">오픈</span>
                        <QuatroMiniCard card={e.card} />
                      </>
                    )}
                    {e.type === 'exchange' && (
                      <>
                        <span className="text-cdm-fg-muted">{vpLabel(e.vpIndex)}와 교환</span>
                        <QuatroMiniCard card={e.gave} dimmed />
                        <span aria-hidden className="text-cdm-fg-subtle">
                          →
                        </span>
                        <QuatroMiniCard card={e.received} />
                      </>
                    )}
                    {e.type === 'stop' && <span className="text-cdm-fg-muted">스탑</span>}
                  </li>
                ))}
              </ul>
            )}
          </Block>
        );
      })}
      <Block title="카드 분배" meta={firstByRound[0] ? `선 ${name(firstByRound[0])}` : undefined}>
        <p className="text-cdm-fg-muted">두 사람에게 4장씩 나눠 줌</p>
      </Block>

      <Block title="멀리건">
        {mulliganRows.length === 0 ? (
          <Empty>아직 결정 전</Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {mulliganRows.map(({ entry, nth }, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <SeatBadge seat={seatOf(0, entry.actorId)} />
                <span className="text-cdm-fg font-semibold">{name(entry.actorId)}</span>
                {entry.type === 'mulligan' && entry.used ? (
                  <span className="text-cdm-primary">
                    멀리건 사용 {nth}/{QUATRO_MAX_MULLIGANS}
                  </span>
                ) : (
                  <span className="text-cdm-fg-muted">이대로 진행</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

function Block({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="rounded-cdm-md border-cdm-border bg-cdm-bg border p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-cdm-fg-muted text-[11px] font-bold">{title}</h4>
        {meta && <span className="text-cdm-fg-subtle min-w-0 truncate text-[11px]">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function SeatBadge({ seat }: { seat: '선' | '후' | null }) {
  if (!seat) return null;
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1 text-[11px] font-bold',
        seat === '선'
          ? 'bg-cdm-highlight/20 text-cdm-highlight'
          : 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
      )}
    >
      {seat}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-cdm-fg-subtle">{children}</p>;
}
