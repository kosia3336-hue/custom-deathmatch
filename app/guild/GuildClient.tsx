'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import { GuildMark } from '@/components/cdm/GuildMark';
import { GuildChatPanel } from '@/components/guild/GuildChatPanel';
import {
  GUILD_EXPANSION_COST_GP,
  GUILD_CHARTER_PRICE_CDP,
  GUILD_MARK_COST_GP,
  GUILD_NAME_CHANGE_COST_GP,
  GUILD_BUFF_MAX_LEVEL,
  guildBuffCost,
  isValidGuildName,
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
        <MyGuildPanel my={my} myMemberId={myMemberId} busy={busy} act={act} refresh={refresh} />
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
          <GuildMark
            mark={guild.markUrl ? { url: guild.markUrl, name: guild.name } : null}
            size="md"
            className="h-8 w-8"
          />
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
        <div className="mt-1 flex items-center gap-1 text-[11px] text-cdm-fg-subtle">
          <span className="rounded-full bg-cdm-bg-elev-2 px-1.5 py-0.5 font-semibold text-cdm-fg-muted">길드장</span>
          {guild.ownerNickname}
          {guild.buffCdpLevel > 0 && (
            <span className="ml-1 text-cdm-primary">· CDP +{guild.buffCdpLevel}%</span>
          )}
        </div>
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
  refresh,
}: {
  my: MyGuildState;
  myMemberId: string;
  busy: boolean;
  act: (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}) {
  const g = my.guild!;
  const isOwner = my.role === 'owner';
  const isViceOwner = my.role === 'vice_owner';
  // 부길드장은 해체만 빼고 길드장과 동일한 권한(가입 승인/추방/설명 수정/버프·마크 구매/확장)
  const canManage = isOwner || isViceOwner;

  return (
    <Card variant="highlight" accent="primary" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <GuildMark mark={g.markUrl ? { url: g.markUrl, name: g.name } : null} size="lg" className="mt-0.5 h-12 w-12" />
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <GuildNameEditor g={g} canManage={canManage} busy={busy} act={act} />
              {isOwner && (
                <span className="rounded-full bg-cdm-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                  길드장
                </span>
              )}
              {isViceOwner && (
                <span className="rounded-full bg-cdm-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                  부길드장
                </span>
              )}
            </div>
            <GuildDescription g={g} canManage={canManage} busy={busy} act={act} />
          </div>
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
            <li key={m.memberId} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-medium text-cdm-fg">{m.nickname}</span>
                {m.role === 'owner' && (
                  <span className="rounded-full bg-cdm-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                    길드장
                  </span>
                )}
                {m.role === 'vice_owner' && (
                  <span className="rounded-full bg-cdm-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                    부길드장
                  </span>
                )}
                {m.memberId === myMemberId && (
                  <span className="text-[11px] text-cdm-fg-subtle">(나)</span>
                )}
              </span>
              <span className="flex shrink-0 gap-1.5">
                {isOwner && m.memberId !== myMemberId && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      const promote = m.role !== 'vice_owner';
                      const verb = promote ? '부길드장으로 임명' : '부길드장에서 해제';
                      if (!confirm(`${m.nickname}님을 ${verb}할까요?`)) return;
                      void act(
                        { action: 'set_vice', targetMemberId: m.memberId, promote },
                        `${m.nickname}님을 ${verb}했어요.`,
                      );
                    }}
                  >
                    {m.role === 'vice_owner' ? '부길드장 해제' : '부길드장 임명'}
                  </Button>
                )}
                {canManage && m.memberId !== myMemberId && m.role !== 'owner' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!confirm(`${m.nickname}님을 길드에서 추방할까요?`)) return;
                      void act({ action: 'kick', targetMemberId: m.memberId }, `${m.nickname}님을 추방했어요.`);
                    }}
                  >
                    추방
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* 길드 채팅 — 길드원 전용, 14일 지난 메시지는 자동 정리 */}
      <div>
        <p className="mb-1.5 text-xs font-semibold text-cdm-fg-muted">길드 채팅</p>
        <GuildChatPanel />
      </div>

      {canManage && my.pendingRequests.length > 0 && (
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

      {/* 길드 버프 — CDP 수완 증가 */}
      <div className="border-t border-cdm-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-cdm-fg">길드 버프 · CDP 수완</p>
            <p className="mt-0.5 text-[11px] text-cdm-fg-muted">
              Lv.{g.buffCdpLevel} / {GUILD_BUFF_MAX_LEVEL} — 길드원이 매 게임 CDP{' '}
              <strong className="text-cdm-primary">+{g.buffCdpLevel}%</strong> 추가 적립
            </p>
          </div>
          {canManage && (
            g.buffCdpLevel >= GUILD_BUFF_MAX_LEVEL ? (
              <span className="text-[11px] font-semibold text-cdm-fg-subtle">최대 레벨</span>
            ) : (
              <Button
                size="sm"
                disabled={busy || g.points < guildBuffCost(g.buffCdpLevel)}
                onClick={() => {
                  const cost = guildBuffCost(g.buffCdpLevel);
                  if (!confirm(`길드 포인트 ${cost.toLocaleString()} GP로 CDP 수완을 Lv.${g.buffCdpLevel + 1}로 올릴까요?`)) return;
                  void act({ action: 'buy_buff' }, `CDP 수완이 Lv.${g.buffCdpLevel + 1}이 됐어요!`);
                }}
              >
                Lv.{g.buffCdpLevel + 1}로 강화 ({guildBuffCost(g.buffCdpLevel).toLocaleString()} GP)
              </Button>
            )
          )}
        </div>
        {/* 레벨 게이지 */}
        <div className="mt-2 flex gap-0.5">
          {Array.from({ length: GUILD_BUFF_MAX_LEVEL }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < g.buffCdpLevel ? 'bg-cdm-primary' : 'bg-cdm-bg-elev-2'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 길드 마크 */}
      {canManage && (
        <div className="border-t border-cdm-border pt-3">
          <p className="text-xs font-semibold text-cdm-fg">길드 마크</p>
          <p className="mt-0.5 text-[11px] text-cdm-fg-muted">
            등록하면 길드원 닉네임 옆에 표시돼요. 등록·변경 시 {GUILD_MARK_COST_GP} GP가 차감돼요. (PNG/JPEG/WebP/GIF, 512KB 이하)
          </p>
          <GuildMarkUploader
            guildPoints={g.points}
            busy={busy}
            hasMark={Boolean(g.markUrl)}
            refresh={refresh}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-cdm-border pt-3">
        {canManage && (
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

/** 길드 이름 표시 + 변경 (길드장·부길드장 전용, 300 GP) */
function GuildNameEditor({
  g,
  canManage,
  busy,
  act,
}: {
  g: MyGuildState['guild'];
  canManage: boolean;
  busy: boolean;
  act: (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(g?.name ?? '');

  if (!g) return null;

  if (editing) {
    const nameValid = isValidGuildName(draft);
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <TextInput
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={20}
            fullWidth={false}
            className="h-8 w-[180px] text-sm"
            autoFocus
          />
          <Button
            size="sm"
            disabled={busy || !nameValid || draft.trim() === g.name}
            onClick={async () => {
              if (!confirm(`길드 포인트 ${GUILD_NAME_CHANGE_COST_GP} GP로 길드명을 "${draft.trim()}"(으)로 변경할까요?`)) return;
              const ok = await act(
                { action: 'update_name', name: draft.trim() },
                '길드명을 변경했어요.',
              );
              if (ok) setEditing(false);
            }}
          >
            저장
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setDraft(g.name);
              setEditing(false);
            }}
          >
            취소
          </Button>
        </div>
        {draft.trim().length > 0 && !nameValid && (
          <p className="text-[11px] text-cdm-danger">
            영어·한글 글자만 사용할 수 있어요. (공백·숫자·특수문자·이모지·자모 단독 입력 불가)
          </p>
        )}
      </div>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <h2 className="text-lg font-bold text-cdm-fg">{g.name}</h2>
      {canManage && (
        <button
          type="button"
          onClick={() => {
            setDraft(g.name);
            setEditing(true);
          }}
          className="text-[11px] text-cdm-primary underline-offset-2 hover:underline"
        >
          이름 변경 ({GUILD_NAME_CHANGE_COST_GP} GP)
        </button>
      )}
    </span>
  );
}

/** 길드 설명 표시 + 수정 (길드장·부길드장 전용) */
function GuildDescription({
  g,
  canManage,
  busy,
  act,
}: {
  g: MyGuildState['guild'];
  canManage: boolean;
  busy: boolean;
  act: (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(g?.description ?? '');

  if (!g) return null;

  if (editing) {
    return (
      <div className="mt-1 flex flex-col gap-1.5">
        <textarea
          className="w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm"
          rows={2}
          maxLength={200}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <div className="flex gap-1.5">
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              const ok = await act(
                { action: 'update_description', description: draft.trim() },
                '길드 설명을 수정했어요.',
              );
              if (ok) setEditing(false);
            }}
          >
            저장
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setDraft(g.description ?? '');
              setEditing(false);
            }}
          >
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-cdm-fg-muted">
      <span>{g.description || (canManage ? '길드 소개를 입력해 보세요.' : '')}</span>
      {canManage && (
        <button
          type="button"
          onClick={() => {
            setDraft(g.description ?? '');
            setEditing(true);
          }}
          className="shrink-0 text-[11px] text-cdm-primary underline-offset-2 hover:underline"
        >
          수정
        </button>
      )}
    </p>
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
  const nameValid = isValidGuildName(name);

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
            disabled={!nameValid}
            onClick={() => void onCreate(name.trim(), description.trim())}
          >
            창설 (창설권 1개 소모)
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">길드 이름 (2~20자, 영어·한글만)</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          {name.trim().length > 0 && !nameValid && (
            <p className="mt-1 text-[11px] text-cdm-danger">
              영어·한글 글자만 사용할 수 있어요. (공백·숫자·특수문자·이모지·자모 단독 입력 불가)
            </p>
          )}
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

/** 길드 마크 업로드 (길드장 전용) */
function GuildMarkUploader({
  guildPoints,
  busy,
  hasMark,
  refresh,
}: {
  guildPoints: number;
  busy: boolean;
  hasMark: boolean;
  refresh: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const affordable = guildPoints >= GUILD_MARK_COST_GP;

  const onPick = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/guild/mark', { method: 'POST', body: form });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? '마크 등록에 실패했어요.');
        return;
      }
      toast.success(`길드 마크를 등록했어요. (-${GUILD_MARK_COST_GP} GP)`);
      await refresh();
    } catch {
      toast.error('마크 등록 중 오류가 발생했어요.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={busy || uploading || !affordable}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? '업로드 중…' : hasMark ? `마크 변경 (${GUILD_MARK_COST_GP} GP)` : `마크 등록 (${GUILD_MARK_COST_GP} GP)`}
      </Button>
      {!affordable && (
        <span className="text-[11px] text-cdm-fg-subtle">길드 포인트가 부족해요.</span>
      )}
    </div>
  );
}
