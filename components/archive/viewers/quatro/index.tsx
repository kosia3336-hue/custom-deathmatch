'use client';

import type { GameRecordFile } from '@/shared/types/archive';
import type { QuatroCard, QuatroLogEntry, QuatroResultSummary, QuatroSuit } from '@/shared/types/quatro';
import { cn } from '@/lib/utils';

/** record.gameRecord 예상 형태 (server quatro finishGame 의 gameResultData) */
interface QuatroRecord {
  result?: QuatroResultSummary;
  log?: QuatroLogEntry[];
  vpHands?: QuatroCard[][];
  players?: Record<string, { nickname: string }>;
}

const SUIT_INFO: Record<QuatroSuit, { symbol: string; cls: string }> = {
  spade: { symbol: '♠', cls: 'text-blue-600 border-blue-300 bg-blue-50' },
  diamond: { symbol: '♦', cls: 'text-yellow-600 border-yellow-300 bg-yellow-50' },
  heart: { symbol: '♥', cls: 'text-red-600 border-red-300 bg-red-50' },
  club: { symbol: '♣', cls: 'text-green-600 border-green-300 bg-green-50' },
  black: { symbol: '●', cls: 'text-white border-gray-700 bg-gray-900' },
};

function MiniCard({ card, dimmed }: { card: QuatroCard; dimmed?: boolean }) {
  const info = SUIT_INFO[card.suit];
  return (
    <span
      className={cn(
        'inline-flex h-9 w-7 flex-col items-center justify-center rounded border text-[11px] font-bold leading-none',
        info.cls,
        dimmed && 'opacity-50',
      )}
    >
      <span>{info.symbol}</span>
      <span>{card.num}</span>
    </span>
  );
}

export default function QuatroViewer({ record }: { record: GameRecordFile }) {
  const data = (record.gameRecord ?? {}) as QuatroRecord;
  const result = data.result;
  const nicknames: Record<string, string> = {};
  for (const [pid, p] of Object.entries(record.players ?? {})) nicknames[pid] = p.nickname;
  for (const [pid, p] of Object.entries(data.players ?? {})) nicknames[pid] ??= p.nickname;

  if (!result) {
    return <p className="py-6 text-center text-sm text-cdm-fg-muted">기록 데이터가 없어요.</p>;
  }

  const rounds = [1, 2, 3, 4];
  const log = data.log ?? [];
  const mulligans = log.filter((e) => e.type === 'mulligan');

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* 최종 결과 */}
      <section className="rounded-cdm-lg border-2 border-cdm-primary bg-cdm-primary-soft/30 p-4">
        <p className="mb-3 text-center text-base font-bold text-cdm-fg">
          {result.winnerId
            ? `${nicknames[result.winnerId] ?? '?'} 승리 — ${result.reason}`
            : `무승부 — ${result.reason}`}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-10">
          {Object.entries(result.hands).map(([pid, cards]) => (
            <div key={pid} className="flex flex-col items-center gap-1.5">
              <span className="font-semibold text-cdm-fg">
                {nicknames[pid] ?? pid.slice(0, 6)}
                <span className="ml-1.5 text-xs font-normal text-cdm-fg-muted">
                  합 {result.sums[pid]}
                  {result.quatro[pid] ? ' · 콰트로!' : ''}
                </span>
              </span>
              <div className="flex gap-1">
                {cards.map((c) => (
                  <MiniCard key={c.id} card={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 멀리건 */}
      {mulligans.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-cdm-fg-subtle">멀리건</h3>
          <div className="flex flex-wrap gap-2">
            {mulligans.map((m, i) => (
              <span
                key={i}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs',
                  m.type === 'mulligan' && m.used
                    ? 'border-cdm-primary/40 bg-cdm-primary-soft text-cdm-primary'
                    : 'border-cdm-border text-cdm-fg-muted',
                )}
              >
                {nicknames[m.actorId] ?? '?'} — {m.type === 'mulligan' && m.used ? '사용' : '패스'}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 라운드별 진행 */}
      {log.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-cdm-fg-subtle">라운드 진행</h3>
          {rounds.map((r) => {
            const entries = log.filter((e) => e.round === r && e.type !== 'mulligan');
            if (entries.length === 0) return null;
            return (
              <div key={r} className="rounded-cdm-md border border-cdm-border bg-cdm-bg p-3">
                <p className="mb-2 text-xs font-bold text-cdm-fg-muted">라운드 {r}</p>
                <ul className="flex flex-col gap-1.5">
                  {entries.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-cdm-fg">
                      <span className="font-semibold">{nicknames[e.actorId] ?? '?'}</span>
                      {e.type === 'open' && (
                        <>
                          <span className="text-cdm-fg-muted">오픈</span>
                          <MiniCard card={e.card} />
                        </>
                      )}
                      {e.type === 'exchange' && (
                        <>
                          <span className="text-cdm-fg-muted">
                            가상 플레이어 {String.fromCharCode(65 + e.vpIndex)}와 교환
                          </span>
                          <MiniCard card={e.gave} dimmed />
                          <span aria-hidden className="text-cdm-fg-subtle">→</span>
                          <MiniCard card={e.received} />
                        </>
                      )}
                      {e.type === 'stop' && <span className="text-cdm-fg-muted">스탑 선언</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {/* 가상 플레이어 최종 패 */}
      {data.vpHands && data.vpHands.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-cdm-fg-subtle">
            가상 플레이어 최종 패
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {data.vpHands.map((cards, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-2">
                <span className="text-[11px] font-bold text-cdm-fg">{String.fromCharCode(65 + i)}</span>
                <div className="flex gap-0.5">
                  {cards.map((c) => (
                    <MiniCard key={c.id} card={c} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
