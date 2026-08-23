'use client';

import { useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { Tabs } from '@/components/cdm/Tabs';
import { TextInput } from '@/components/cdm/TextInput';
import { formatCdpWithUnit } from '@/lib/cdp/format';
import type { MyGuildState } from '@/lib/guild/types';
import type { GuildConfirm } from './GuildConfirmModal';
import { DEV_GRANT_MIN } from './limits';
import { useGuildDevStore } from './store';

type Act = (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;

const GRANT_TABS = [
  { id: 'grant', label: '지급' },
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

export function GuildGrantSection({
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
  const canGrant = my.role === 'owner' || my.role === 'vice_owner';
  const tabs = canGrant ? [...GRANT_TABS] : [{ id: 'log', label: '로그' }];
  const [tab, setTab] = useState<string>(canGrant ? 'grant' : 'log');

  return (
    <div className="flex flex-col gap-3">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'grant' && canGrant ? (
        <GrantForm my={my} busy={busy} act={act} askConfirm={askConfirm} />
      ) : null}
      {tab === 'log' ? <GrantLogList myMemberId={myMemberId} /> : null}
    </div>
  );
}

function GrantForm({
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
  const canGrant = my.role === 'owner' || my.role === 'vice_owner';
  const [targetId, setTargetId] = useState('');
  const [raw, setRaw] = useState('');
  const amount = Math.trunc(Number(raw));
  const validNum = Number.isFinite(amount) && raw.trim() !== '';
  const tooSmall = validNum && amount < DEV_GRANT_MIN;
  const insufficient = validNum && my.guild!.points < amount;
  const target = my.members.find((m) => m.memberId === targetId);
  const canSubmit =
    canGrant && Boolean(target) && validNum && !tooSmall && !insufficient && !busy;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cdm-fg-muted">
        <span className="block">
          길드 <strong className="tabular-nums text-cdm-primary">{formatGp(my.guild!.points)}</strong>
        </span>
      </p>
      <p className="text-sm text-cdm-fg-muted">
        <span className="block">길드 자금으로 CDP를 지급합니다.</span>
        <span className="block">비율 1:1</span>
      </p>
      {!canGrant ? (
        <p className="text-sm text-cdm-fg-muted">길드장·부길드장만 지급할 수 있습니다.</p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="dev-grant-target" className="text-sm font-medium text-cdm-fg">
          받을 길드원
        </label>
        <select
          id="dev-grant-target"
          value={targetId}
          disabled={!canGrant || busy}
          onChange={(e) => setTargetId(e.target.value)}
          className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm text-cdm-fg focus:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">선택</option>
          {my.members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.nickname}
            </option>
          ))}
        </select>
      </div>
      <TextInput
        label="지급 GP"
        inputMode="numeric"
        value={raw}
        disabled={!canGrant}
        onChange={(e) => setRaw(e.target.value.replace(/[^\d]/g, ''))}
        hint={
          validNum && !tooSmall
            ? `${amount.toLocaleString('ko-KR')} GP → ${formatCdpWithUnit(amount)}`
            : `최소 ${DEV_GRANT_MIN} GP`
        }
        error={
          tooSmall
            ? `최소 ${DEV_GRANT_MIN} GP부터 지급할 수 있습니다.`
            : insufficient
              ? '길드 포인트가 부족합니다.'
              : null
        }
      />
      <Button
        disabled={!canSubmit}
        onClick={() => {
          if (!target) return;
          askConfirm({
            title: 'CDP 지급',
            message: `${target.nickname}님에게 ${amount.toLocaleString('ko-KR')} CDP를 지급합니다.\n길드 자금 ${amount.toLocaleString('ko-KR')} GP가 쓰입니다.`,
            confirmLabel: '지급',
            variant: 'primary',
            run: () =>
              act(
                { action: 'grant_cdp', targetMemberId: target.memberId, amount },
                `${target.nickname}님에게 ${formatCdpWithUnit(amount)}를 지급했습니다.`,
              ).then((ok) => {
                if (ok) setRaw('');
                return ok;
              }),
          });
        }}
      >
        {canGrant ? '지급' : '권한 없음'}
      </Button>
    </div>
  );
}

function GrantLogList({ myMemberId }: { myMemberId: string }) {
  const logs = useGuildDevStore((s) => s.grantLogs);

  if (logs.length === 0) {
    return <p className="py-6 text-center text-sm text-cdm-fg-muted">아직 지급 기록이 없습니다.</p>;
  }

  return (
    <ol className="flex flex-col gap-0.5">
      {logs.map((row) => {
        const isMe = row.toMemberId === myMemberId || row.fromMemberId === myMemberId;
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
              {row.fromNickname}
              {row.fromMemberId === myMemberId ? (
                <span className="text-[11px] text-cdm-fg-subtle"> (나)</span>
              ) : null}
              <span className="text-cdm-fg-muted"> → </span>
              {row.toNickname}
              {row.toMemberId === myMemberId ? (
                <span className="text-[11px] text-cdm-fg-subtle"> (나)</span>
              ) : null}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-cdm-fg">
              {formatCdpWithUnit(row.amount)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
