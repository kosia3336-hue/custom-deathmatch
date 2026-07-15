'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import {
  GUILD_EXPANSION_COST_GP,
  GUILD_CHARTER_PRICE_CDP,
  type GuildSummary,
  type MyGuildState,
} from '@/lib/guild/types';

interface Props {
  initialGuilds: GuildSummary[];
  initialMy: MyGuildState;
  myMemberId: string;
}

export default function GuildClient({ initialGuilds, initialMy, myMemberId }: Props) {
  const [guilds, setGuilds] = useState(initialGuilds);
  const [my, setMy] = useState(initialMy);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/guild');
    if (!res.ok) return;
    const json = (await res.json()) as { guilds: GuildSummary[]; my: MyGuildState };
    setGuilds(json.guilds);
    setMy(json.my);
  }, []);

  const act = useCallback(
    async (payload: Record<string, unknown>, successMsg?: string): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await fetch('/api/guild/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          toast.error(json.error ?? '처리에 실패했어요.');
          return false;
        }
        if (successMsg) toast.success(successMsg);
        await refresh();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-cdm-fg">길드</h1>
          <p className="mt-1 text-sm text-cdm-fg-muted">
            길드에 가입하고 함께 게임하며 길드 포인트를 모아 보세요.
          </p>
        </div>
        {!my.guild && (
          <Button
            onClick={() => {
              if (my.charterCount <= 0) {
                toast(`길드 창설권이 필요해요. 상점에서 ${GUILD_CHARTER_PRICE_CDP.toLocaleString()} CDP에 구매할 수 있어요.`);
                return;
              }
              setCreateOpen(true);
            }}
            disabled={busy}
          >
            길드 창설
          </Button>
        )}
      </header>

      {my.guild ? (
        <MyGuildPanel my={my} myMemberId={myMemberId} busy={busy} act={act} />
      ) : my.myRequest ? (
        <Card className="flex items-center justify-between gap-3">
          <p className="text-sm text-cdm-fg">
            <strong>{my.myRequest.guildName}</strong> 길드에 가입 신청 중이에요.
          </p>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => act({ action: 'cancel_join', requestId: my.myRequest!.id }, '신청을 취소했어요.')}
          >
            신청 취소
          </Button>
        </Card>
      ) : (
        <Card className="text-sm text-cdm-fg-muted">
          아직 가입한 길드가 없어요. 아래 목록에서 가입 신청하거나, 길드 창설권(
          {GUILD_CHARTER_PRICE_CDP.toLocaleString()} CDP)으로 직접 창설할 수 있어요.
          {my.charterCount > 0 && (
            <span className="ml-1 font-semibold text-cdm-primary">
              창설권 {my.charterCount}개 보유 중
            </span>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-cdm-fg">길드 목록</h2>
        {guilds.length === 0 ? (
          <Card className="py-10 text-center text-sm text-cdm-fg-muted">
            아직 창설된 길드가 없어요. 첫 길드를 만들어 보세요!
          </Card>
        ) : (
          guilds.map((g) => (
            <GuildRow
              key={g.id}
              guild={g}
              canJoin={!my.guild && !my.myRequest}
              busy={busy}
              onJoin={() => act({ action: 'join', guildId: g.id }, '가입 신청을 보냈어요.')}
            />
          ))
        )}
      </section>

      {createOpen && (
        <CreateGuildModal
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onCreate={async (name, description) => {
            const ok = await act({ action: 'create', name, description }, '길드를 창설했어요!');
            if (ok) setCreateOpen(false);
          }}
        />
      )}
    </>
  );
}

function GuildRow({
  guild,
  canJoin,
  busy,
  onJoin,
}: {
  guild: GuildSummary;
  canJoin: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  const full = guild.memberCount >= guild.capacity;
  return (
    <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-cdm-fg">{guild.name}</p>
          <span className="shrink-0 text-xs tabular-nums text-cdm-fg-muted">
            {guild.memberCount}/{guild.capacity}명
          </span>
          <span className="shrink-0 rounded-full bg-cdm-primary-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-cdm-primary">
            {guild.points.toLocaleString()} GP
          </span>
        </div>
        {guild.description && (
          <p className="mt-0.5 truncate text-sm text-cdm-fg-muted">{guild.description}</p>
        )}
        <div className="mt-1 text-[11px] text-cdm-fg-subtle">길드장 {guild.ownerNickname}</div>
      </div>
      {canJoin && (
        <Button size="sm" variant="secondary" disabled={busy || full} onClick={onJoin}>
          {full ? '정원 마감' : '가입 신청'}
        </Button>
      )}
    </Card>
  );
}

function MyGuildPanel({
  my,
  myMemberId,
  busy,
  act,
}: {
  my: MyGuildState;
  myMemberId: string;
  busy: boolean;
  act: (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;
}) {
  const g = my.guild!;
  const isOwner = my.role === 'owner';

  return (
    <Card variant="highlight" accent="primary" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-cdm-fg">{g.name}</h2>
          {g.description && <p className="mt-0.5 text-sm text-cdm-fg-muted">{g.description}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-cdm-fg-muted">길드 포인트</p>
          <p className="text-lg font-bold tabular-nums text-cdm-primary">
            {g.points.toLocaleString()} GP
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-cdm-fg-muted">
          길드원 {g.memberCount}/{g.capacity}
        </p>
        <ul className="flex flex-col gap-1">
          {my.members.map((m) => (
            <li key={m.memberId} className="flex items-center gap-2 text-sm">
              <span className="font-medium text-cdm-fg">{m.nickname}</span>
              {m.role === 'owner' && (
                <span className="rounded-full bg-cdm-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                  길드장
                </span>
              )}
              {m.memberId === myMemberId && (
                <span className="text-[11px] text-cdm-fg-subtle">(나)</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isOwner && my.pendingRequests.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-cdm-fg-muted">
            가입 신청 {my.pendingRequests.length}건
          </p>
          <ul className="flex flex-col gap-1.5">
            {my.pendingRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-cdm-fg">{r.nickname}</span>
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => act({ action: 'decide', requestId: r.id, approve: true }, '가입을 승인했어요.')}
                  >
                    승인
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => act({ action: 'decide', requestId: r.id, approve: false }, '거절했어요.')}
                  >
                    거절
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-cdm-border pt-3">
        {isOwner && (
          <Button
            size="sm"
            disabled={busy || g.points < GUILD_EXPANSION_COST_GP}
            onClick={() => {
              if (!confirm(`길드 포인트 ${GUILD_EXPANSION_COST_GP} GP로 정원을 1 늘릴까요?`)) return;
              void act({ action: 'expand' }, '정원이 1 늘었어요!');
            }}
          >
            길드원 추가 모집권 구매 ({GUILD_EXPANSION_COST_GP} GP)
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            const warn = isOwner
              ? '길드를 해체할까요? (다른 길드원이 남아 있으면 해체할 수 없어요)'
              : '길드에서 탈퇴할까요?';
            if (!confirm(warn)) return;
            void act({ action: 'leave' }, isOwner ? '길드를 해체했어요.' : '길드에서 탈퇴했어요.');
          }}
        >
          {isOwner ? '길드 해체' : '길드 탈퇴'}
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-cdm-fg-subtle">
        길드 포인트는 길드원이 랭크 게임을 플레이하면 적립돼요 (승리 +10 / 무승부 +5 / 패배 +4).
        모은 포인트로 길드원 추가 모집권 등을 구매할 수 있어요.
      </p>
    </Card>
  );
}

function CreateGuildModal({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="길드 창설"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            loading={busy}
            disabled={name.trim().length < 2}
            onClick={() => void onCreate(name.trim(), description.trim())}
          >
            창설 (창설권 1개 소모)
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">길드 이름 (2~20자)</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">소개 (선택, 200자)</label>
          <textarea
            className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm"
            rows={3}
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <p className="text-[11px] text-cdm-fg-subtle">초기 정원은 3명이에요. 길드 포인트로 정원을 늘릴 수 있어요.</p>
      </div>
    </Modal>
  );
}
