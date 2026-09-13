import Link from 'next/link';
import { formatShareDateTime } from '@/lib/resultShare';
import {
  formatShareOpponents,
  formatSharePlayTime,
  type ResultShareView,
} from '@/lib/share/resultShareView';

const TONE_CLASS: Record<ResultShareView['result'], string> = {
  win: 'text-cdm-highlight',
  lose: 'text-cdm-ink-fg-muted',
  draw: 'text-sky-300',
  resign: 'text-cdm-ink-fg-muted',
};

/** 결과 공유 페이지 본문 카드. 카드 이미지(lib/share/resultCardImage.tsx)와 같은 정보·배치. */
export default function ResultShareCard({ view }: { view: ResultShareView }) {
  const when = formatShareDateTime(view.playedAt);
  const facts = [
    { label: '일시', value: when ?? '—' },
    { label: '플레이', value: formatSharePlayTime(view.playTimeMs) },
    { label: '진행', value: `${view.totalTurns}턴` },
  ];

  return (
    <article className="ink-scope w-full max-w-lg rounded-cdm-lg bg-cdm-ink p-6 text-cdm-ink-fg shadow-lg sm:p-8">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.3em] text-cdm-ink-fg-muted">
          CUSTOM DEATHMATCH
        </span>
        {view.isRanked && (
          <span className="rounded-full border border-cdm-highlight px-2.5 py-0.5 text-xs font-semibold text-cdm-highlight">
            랭크전
          </span>
        )}
      </div>

      <p className="mt-6 text-sm font-semibold text-cdm-ink-fg-muted">{view.gameName}</p>
      <h1 className={`mt-1 text-6xl font-black tracking-tight ${TONE_CLASS[view.result]}`}>
        {view.resultLabel}
      </h1>
      <p className="mt-3 text-xl font-bold break-keep text-white">
        {view.sharerNickname}
        {view.opponents.length > 0 && (
          <>
            <span className="mx-2 text-base font-semibold text-cdm-ink-fg-muted">vs</span>
            {formatShareOpponents(view.opponents)}
          </>
        )}
      </p>

      <dl className="mt-6 grid grid-cols-3 gap-2 border-t border-cdm-ink-border pt-4 text-center">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-[11px] text-cdm-ink-fg-muted">{f.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-cdm-ink-fg tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/lobby"
          className="flex h-11 flex-1 items-center justify-center rounded-cdm-md bg-cdm-primary text-sm font-bold text-white"
        >
          나도 한 판 하러 가기
        </Link>
        <Link
          href={`/rules/${view.gameId}`}
          className="flex h-11 flex-1 items-center justify-center rounded-cdm-md border border-white/16 bg-white/10 text-sm font-bold text-cdm-ink-fg"
        >
          {view.gameName} 룰 보기
        </Link>
      </div>
    </article>
  );
}
