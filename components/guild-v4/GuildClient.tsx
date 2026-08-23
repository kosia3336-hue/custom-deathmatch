'use client';

/** 길드 v4 내 길드 섹션. 운영 `/guild` 대시보드에서 사용. */

import { useEffect, useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { type MyGuildState } from '@/lib/guild/types';
import type { GuildConfirm } from './GuildConfirmModal';
import { toast } from 'sonner';
import {
  DEV_GUILD_DESC_MAX,
  DEV_MAX_VICE_OWNERS,
  DEV_VICE_FULL_MESSAGE,
  DEV_VICE_LIMIT_HINT,
} from './limits';
import { useGuildDevStore } from './store';
import {
  BannerFlourish,
  CrownIcon,
  GuildBannerCrest,
  GuildBannerFrame,
  GuildBannerStyles,
  PeopleIcon,
} from './GuildBanner';
import {
  DEV_DEFAULT_TILE_ORDER,
  DEV_TILE_LABEL,
  moveTile,
  reorderTile,
  sameTileOrder,
  type DevTileId,
} from './tiles';

type Act = (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;

function roleFlags(my: MyGuildState) {
  const isOwner = my.role === 'owner';
  const isViceOwner = my.role === 'vice_owner';
  return { isOwner, isViceOwner, canManage: isOwner || isViceOwner };
}

export function GuildIdentityCard({
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
  const g = my.guild!;
  const { isOwner, canManage } = roleFlags(my);
  const hasMark = Boolean(g.markUrl);

  return (
    <GuildBannerFrame>
      <div className="guild-banner-body" data-bare={hasMark ? undefined : ''}>
        {g.markUrl ? <GuildBannerCrest src={g.markUrl} name={g.name} /> : null}

        <div className="guild-banner-copy">
          <div className="guild-banner-title">
            <BannerFlourish />
            <h2>{g.name}</h2>
            <span className="guild-banner-lv">Lv.{g.buffCdpLevel}</span>
            <BannerFlourish flip />
          </div>

          <div className="guild-banner-plates">
            <span className="guild-banner-plate">
              <CrownIcon />
              <em>길드장</em>
              {g.ownerNickname || '—'}
            </span>
            <span className="guild-banner-plate">
              <PeopleIcon />
              <em>정원</em>
              <span className="tabular-nums">
                {g.memberCount}/{g.capacity}
              </span>
            </span>
          </div>

          <GuildDescription g={g} canManage={canManage} busy={busy} act={act} banner />
        </div>
      </div>

      {!isOwner && (
        <button
          type="button"
          disabled={busy}
          className="guild-banner-leave"
          onClick={() => {
            askConfirm({
              title: '길드 탈퇴',
              message: '길드에서 탈퇴하시겠습니까?',
              confirmLabel: '탈퇴',
              variant: 'danger',
              run: () => act({ action: 'leave' }, '길드에서 탈퇴했습니다.'),
            });
          }}
        >
          길드 탈퇴
        </button>
      )}

      <GuildBannerStyles />
    </GuildBannerFrame>
  );
}

export function GuildMembersSection({
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
  const g = my.guild!;
  const { isOwner, canManage } = roleFlags(my);

  return (
    <div className="flex flex-col gap-4">
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
                      if (promote) {
                        const viceCount = my.members.filter((x) => x.role === 'vice_owner').length;
                        if (viceCount >= DEV_MAX_VICE_OWNERS) {
                          toast.error(DEV_VICE_FULL_MESSAGE);
                          return;
                        }
                        askConfirm({
                          title: '부길드장 임명',
                          message: `${m.nickname}님을 부길드장으로 임명하시겠습니까?\n${DEV_VICE_LIMIT_HINT}`,
                          confirmLabel: '임명',
                          variant: 'primary',
                          run: () =>
                            act(
                              { action: 'set_vice', targetMemberId: m.memberId, promote: true },
                              `${m.nickname}님을 부길드장으로 임명했습니다.`,
                            ),
                        });
                        return;
                      }
                      askConfirm({
                        title: '부길드장 해제',
                        message: `${m.nickname}님을 부길드장에서 해제하시겠습니까?`,
                        confirmLabel: '해제',
                        variant: 'danger',
                        run: () =>
                          act(
                            { action: 'set_vice', targetMemberId: m.memberId, promote: false },
                            `${m.nickname}님을 부길드장에서 해제했습니다.`,
                          ),
                      });
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
                      askConfirm({
                        title: '길드원 추방',
                        message: `${m.nickname}님을 길드에서 추방하시겠습니까?`,
                        confirmLabel: '추방',
                        variant: 'danger',
                        run: () =>
                          act(
                            { action: 'kick', targetMemberId: m.memberId },
                            `${m.nickname}님을 추방했습니다.`,
                          ),
                      });
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
    </div>
  );
}

export function GuildJoinRequestsSection({
  my,
  busy,
  act,
}: {
  my: MyGuildState;
  busy: boolean;
  act: Act;
}) {
  const { canManage } = roleFlags(my);
  if (!canManage) return null;

  if (my.pendingRequests.length === 0) {
    return <p className="py-6 text-center text-sm text-cdm-fg-muted">대기 중인 신청이 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {my.pendingRequests.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-cdm-fg">{r.nickname}</span>
          <span className="flex gap-1.5">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => act({ action: 'decide', requestId: r.id, approve: true }, '가입을 승인했습니다.')}
            >
              승인
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => act({ action: 'decide', requestId: r.id, approve: false }, '거절했습니다.')}
            >
              거절
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function GuildTileLayoutEditor({
  saved,
  busy,
  act,
  onBack,
}: {
  saved: DevTileId[];
  busy: boolean;
  act: Act;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(saved);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const dirty = !sameTileOrder(draft, saved);
  const atDefault = sameTileOrder(draft, DEV_DEFAULT_TILE_ORDER);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="cursor-pointer self-start text-sm font-medium text-cdm-primary hover:underline"
        onClick={onBack}
      >
        ← 운영
      </button>
      <p className="text-xs text-cdm-fg-muted">
        줄을 드래그하거나 위로/아래로 옮긴 뒤 저장하세요. 길드원 모두에게 같이 적용됩니다.
      </p>
      <ul className="flex flex-col">
        {draft.map((id, index) => (
          <li
            key={id}
            draggable
            onDragStart={() => setDragFrom(index)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragFrom === null || dragFrom === index) return;
              setDraft((prev) => reorderTile(prev, dragFrom, index));
              setDragFrom(index);
            }}
            onDragEnd={() => setDragFrom(null)}
            className={`flex cursor-grab items-center justify-between gap-2 border-b border-cdm-border py-2.5 last:border-0 active:cursor-grabbing ${
              dragFrom === index ? 'opacity-50' : ''
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-cdm-fg-subtle" aria-hidden>
                ≡
              </span>
              <span className="text-sm font-medium text-cdm-fg">{DEV_TILE_LABEL[id]}</span>
            </span>
            <span
              className="flex shrink-0 gap-1"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                draggable={false}
                disabled={busy || index === 0}
                aria-label="위로"
                className="cursor-pointer rounded-cdm-md border border-cdm-border px-2 py-1 text-xs font-bold text-cdm-fg disabled:cursor-not-allowed disabled:opacity-30"
                onClick={() => setDraft((prev) => moveTile(prev, index, -1))}
              >
                위로
              </button>
              <button
                type="button"
                draggable={false}
                disabled={busy || index === draft.length - 1}
                aria-label="아래로"
                className="cursor-pointer rounded-cdm-md border border-cdm-border px-2 py-1 text-xs font-bold text-cdm-fg disabled:cursor-not-allowed disabled:opacity-30"
                onClick={() => setDraft((prev) => moveTile(prev, index, 1))}
              >
                아래로
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || atDefault}
          className="cursor-pointer"
          onClick={() => setDraft([...DEV_DEFAULT_TILE_ORDER])}
        >
          초기화
        </Button>
        <Button
          size="sm"
          disabled={busy || !dirty}
          className="cursor-pointer"
          onClick={() => {
            void act({ action: 'set_tile_order', order: draft }, '메뉴 배치를 저장했습니다.');
          }}
        >
          저장
        </Button>
      </div>
    </div>
  );
}

export function GuildOpsSection({
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
  const [step, setStep] = useState<'menu' | 'transfer' | 'layout'>('menu');
  const { isOwner, canManage } = roleFlags(my);
  const tileOrder = useGuildDevStore((s) => s.tileOrder);

  if (!canManage) {
    return <p className="py-6 text-center text-sm text-cdm-fg-muted">길드장·부길드장만 볼 수 있습니다.</p>;
  }

  const others = my.members.filter((m) => m.memberId !== myMemberId);
  const alone = others.length === 0;

  if (step === 'layout') {
    return (
      <GuildTileLayoutEditor
        saved={tileOrder}
        busy={busy}
        act={act}
        onBack={() => setStep('menu')}
      />
    );
  }

  if (step === 'transfer') {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="cursor-pointer self-start text-sm font-medium text-cdm-primary hover:underline"
          onClick={() => setStep('menu')}
        >
          ← 운영
        </button>
        {alone ? (
          <p className="py-4 text-center text-sm text-cdm-fg-muted">위임할 길드원이 없습니다.</p>
        ) : (
          <ul className="flex flex-col">
            {others.map((m) => (
              <li key={m.memberId} className="border-b border-cdm-border last:border-0">
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-2 py-3 text-left text-sm disabled:opacity-50"
                  onClick={() => {
                    askConfirm({
                      title: '길드장 위임',
                      message: `${m.nickname}님에게 길드장을 위임하시겠습니까? 당신은 일반 길드원이 됩니다.`,
                      confirmLabel: '위임',
                      variant: 'danger',
                      run: () =>
                        act(
                          { action: 'transfer', targetMemberId: m.memberId },
                          `${m.nickname}님에게 길드장을 위임했습니다.`,
                        ),
                    });
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-cdm-fg">{m.nickname}</span>
                    {m.role === 'vice_owner' && (
                      <span className="rounded-full bg-cdm-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                        부길드장
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-cdm-fg-muted">위임</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      <li className="border-b border-cdm-border">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between py-3.5 text-left text-sm font-medium text-cdm-fg"
          onClick={() => setStep('layout')}
        >
          메뉴 배치
          <span className="text-cdm-fg-subtle" aria-hidden>
            ›
          </span>
        </button>
      </li>
      {isOwner && (
        <li className="border-b border-cdm-border">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between py-3.5 text-left text-sm font-medium text-cdm-fg"
            onClick={() => setStep('transfer')}
          >
            길드장 위임
            <span className="text-cdm-fg-subtle" aria-hidden>
              ›
            </span>
          </button>
        </li>
      )}
      {isOwner && (
        <li>
          <button
            type="button"
            disabled={busy}
            className="flex w-full cursor-pointer items-center justify-between py-3.5 text-left text-sm font-medium text-cdm-danger disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              askConfirm({
                title: '길드 해체',
                message: '길드를 정말 해체하겠습니까?',
                confirmLabel: '해체',
                variant: 'danger',
                run: () => act({ action: 'leave' }, '길드를 해체했습니다.'),
              });
            }}
          >
            길드 해체
          </button>
        </li>
      )}
    </ul>
  );
}

/** 길드 설명 표시 + 수정 (길드장·부길드장 전용) */
function GuildDescription({
  g,
  canManage,
  busy,
  act,
  banner = false,
}: {
  g: MyGuildState['guild'];
  canManage: boolean;
  busy: boolean;
  act: (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;
  banner?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(g?.description ?? '');

  if (!g) return null;

  if (editing) {
    return (
      <div className={banner ? 'guild-banner-motto guild-banner-motto-edit' : 'mt-1 flex flex-col gap-1.5'}>
        <textarea
          className="w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm text-cdm-fg"
          rows={2}
          maxLength={DEV_GUILD_DESC_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, DEV_GUILD_DESC_MAX))}
          autoFocus
        />
        <div className="flex items-center gap-1.5">
          <span
            className={`mr-auto tabular-nums text-[11px] ${
              draft.length > DEV_GUILD_DESC_MAX ? 'text-cdm-danger' : 'text-cdm-fg-subtle'
            }`}
          >
            {draft.length}/{DEV_GUILD_DESC_MAX}
          </span>
          <Button
            size="sm"
            disabled={busy || draft.length > DEV_GUILD_DESC_MAX}
            onClick={async () => {
              const ok = await act(
                { action: 'update_description', description: draft.trim().slice(0, DEV_GUILD_DESC_MAX) },
                '길드 설명을 수정했습니다.',
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

  const text = g.description || (canManage ? '길드 소개를 입력해 보세요.' : '');
  if (!text) return null;

  if (banner) {
    return (
      <p className="guild-banner-motto">
        <span>{text}</span>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setDraft(g.description ?? '');
              setEditing(true);
            }}
            className="guild-banner-edit"
          >
            수정
          </button>
        )}
      </p>
    );
  }

  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-cdm-fg-muted">
      <span>{text}</span>
      {canManage && (
        <button
          type="button"
          onClick={() => {
            setDraft(g.description ?? '');
            setEditing(true);
          }}
          className="cursor-pointer shrink-0 text-[11px] text-cdm-primary underline-offset-2 hover:underline"
        >
          수정
        </button>
      )}
    </p>
  );
}
