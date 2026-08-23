'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { Tabs } from '@/components/cdm/Tabs';
import { TextInput } from '@/components/cdm/TextInput';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { formatCdpWithUnit } from '@/lib/cdp/format';
import type { TitleColor } from '@/lib/supabase/database.types';
import type { MyGuildState } from '@/lib/guild/types';
import type { GuildConfirm } from './GuildConfirmModal';
import { DEV_INVEST_MIN_CDP, investCdpToGp } from './limits';
import { useGuildDevStore } from './store';

type Act = (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;

const INVEST_TABS = [
  { id: 'invest', label: '투자' },
  { id: 'rank', label: '랭킹' },
  { id: 'log', label: '로그' },
] as const;

function formatGp(n: number) {
  return `${n.toLocaleString('ko-KR')} GP`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GuildInvestSection({
  my,
  myMemberId,
  busy,
  act,
  askConfirm,
}: {
  my: MyGuildState;
  myMemberId: string;
  busy: boolean;
  act: Act;
  askConfirm: (confirm: GuildConfirm) => void;
}) {
  const [tab, setTab] = useState<string>('invest');

  return (
    <div className="flex flex-col gap-3">
      <Tabs tabs={[...INVEST_TABS]} value={tab} onChange={setTab} />
      {tab === 'invest' ? (
        <InvestForm my={my} busy={busy} act={act} askConfirm={askConfirm} />
      ) : null}
      {tab === 'rank' ? <InvestRankList my={my} myMemberId={myMemberId} /> : null}
      {tab === 'log' ? <InvestLogList myMemberId={myMemberId} /> : null}
    </div>
  );
}

function InvestForm({
  my,
  busy,
  act,
  askConfirm,
}: {
  my: MyGuildState;
  busy: boolean;
  act: Act;
  askConfirm: (confirm: GuildConfirm) => void;
}) {
  const myCdp = useGuildDevStore((s) => s.myCdp);
  const [raw, setRaw] = useState('');
  const cdp = Math.trunc(Number(raw));
  const validNum = Number.isFinite(cdp) && raw.trim() !== '';
  const gp = validNum ? investCdpToGp(cdp) : 0;
  const tooSmall = validNum && cdp < DEV_INVEST_MIN_CDP;
  const insufficient = validNum && cdp > myCdp;
  const canInvest = validNum && !tooSmall && !insufficient && gp >= 1 && !busy;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cdm-fg-muted">
        <span className="block">
          길드 <strong className="tabular-nums text-cdm-primary">{formatGp(my.guild!.points)}</strong>
        </span>
        <span className="block">
          내 <strong className="tabular-nums text-cdm-primary">{formatCdpWithUnit(myCdp)}</strong>
        </span>
      </p>
      <p className="text-sm text-cdm-fg-muted">
        <span className="block">내 CDP를 길드 자금으로 바꿉니다.</span>
        <span className="block">비율 2/3</span>
      </p>
      <TextInput
        label="투자 CDP"
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value.replace(/[^\d]/g, ''))}
        placeholder="99"
        hint={
          validNum && !tooSmall
            ? `${cdp.toLocaleString('ko-KR')} CDP → ${gp.toLocaleString('ko-KR')} GP`
            : `최소 ${DEV_INVEST_MIN_CDP} CDP`
        }
        error={
          tooSmall
            ? `최소 ${DEV_INVEST_MIN_CDP} CDP부터 투자할 수 있습니다.`
            : insufficient
              ? 'CDP가 부족합니다.'
              : null
        }
      />
      <Button
        disabled={!canInvest}
        onClick={() => {
          askConfirm({
            title: '길드 투자',
            message: `${cdp.toLocaleString('ko-KR')} CDP를 투자합니다.\n길드 자금 ${gp.toLocaleString('ko-KR')} GP가 들어갑니다.`,
            confirmLabel: '투자',
            variant: 'primary',
            run: () =>
              act(
                { action: 'invest', cdp },
                `${gp.toLocaleString('ko-KR')} GP가 길드 자금에 들어갔습니다.`,
              ).then((ok) => {
                if (ok) setRaw('');
                return ok;
              }),
          });
        }}
      >
        투자
      </Button>
    </div>
  );
}

function InvestRankList({ my, myMemberId }: { my: MyGuildState; myMemberId: string }) {
  const sponsors = useGuildDevStore((s) => s.sponsors);
  const titles = useGuildDevStore((s) => s.titles);

  const rows = useMemo(() => {
    return [...my.members]
      .map((m) => ({
        memberId: m.memberId,
        nickname: m.nickname,
        gp: sponsors[m.memberId]?.gp ?? 0,
        title: titles[m.memberId] ?? null,
      }))
      .sort((a, b) => {
        if (b.gp !== a.gp) return b.gp - a.gp;
        return a.nickname.localeCompare(b.nickname, 'ko');
      });
  }, [my.members, sponsors, titles]);

  return (
    <ol className="flex flex-col gap-0.5">
      {rows.map((m, i) => {
        const rank = i + 1;
        const isMe = m.memberId === myMemberId;
        const title = m.title;
        return (
          <li
            key={m.memberId}
            className={`flex items-center gap-3 rounded-cdm-md px-2 py-1.5 text-sm ${
              isMe ? 'bg-cdm-primary-soft' : ''
            }`}
          >
            <span
              className={`w-6 shrink-0 text-center text-xs font-bold tabular-nums ${
                rank === 1 ? 'text-cdm-highlight-strong' : 'text-cdm-fg-muted'
              }`}
            >
              {rank}
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <span className="truncate font-medium text-cdm-fg">
                {m.nickname}
                {isMe ? (
                  <span className="ml-1 text-[11px] font-normal text-cdm-fg-subtle">(나)</span>
                ) : null}
              </span>
              {title ? (
                <TitleBadge
                  name={title.name}
                  color={title.color as TitleColor}
                  effect={title.effect as TitleEffect | null}
                  size="sm"
                />
              ) : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-cdm-fg">{formatGp(m.gp)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function InvestLogList({ myMemberId }: { myMemberId: string }) {
  const logs = useGuildDevStore((s) => s.investLogs);

  if (logs.length === 0) {
    return <p className="py-6 text-center text-sm text-cdm-fg-muted">아직 투자 기록이 없습니다.</p>;
  }

  return (
    <ol className="flex flex-col gap-0.5">
      {logs.map((row) => {
        const isMe = row.memberId === myMemberId;
        return (
          <li
            key={row.id}
            className={`flex items-center gap-2 rounded-cdm-md px-2 py-1 text-sm ${
              isMe ? 'bg-cdm-primary-soft' : ''
            }`}
          >
            <time className="shrink-0 text-xs text-cdm-fg-muted" dateTime={row.createdAt}>
              {formatWhen(row.createdAt)}
            </time>
            <span className="min-w-0 flex-1 truncate text-cdm-fg">
              {row.nickname}
              {isMe ? (
                <span className="text-[11px] text-cdm-fg-subtle"> (나)</span>
              ) : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-cdm-fg">
              {row.cdp.toLocaleString('ko-KR')} CDP → {formatGp(row.gp)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
