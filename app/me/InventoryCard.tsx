'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { useInventoryStore } from '@/stores/inventory';
import { CONSUMABLE_LABELS, type ConsumableKind } from '@/lib/cdp/types';

interface ConsumableMeta {
  emoji: string;
  description: string;
  /** 사용자가 직접 사용하는지(true)·자동 소비(false) */
  manual: boolean;
  /** 추가 안내 (자동인 경우 발동 시점) */
  trigger?: string;
}

const META: Record<ConsumableKind, ConsumableMeta> = {
  nickname_change: {
    emoji: '✏️',
    description: '닉네임을 변경할 수 있다.',
    manual: true,
    trigger: '환경 설정 → 닉네임 변경 모달의 "변경권 사용" 체크',
  },
  rank_reset: {
    emoji: '🔄',
    description: '이번 시즌 랭크 전적을 초기화한다. 단, 전체전적은 초기화되지 않는다.',
    manual: true,
  },
  spectator_lock: {
    emoji: '🔒',
    description: '내 게임을 관전할 수 없게 한다. 자동사용되며, 1게임 당 1개씩 사용된다.',
    manual: false,
    trigger: '랭크 게임 매칭 시 자동으로 1개 사용',
  },
  anonymity: {
    emoji: '🥷',
    description: '랭크 게임에서 상대에게 내 닉네임이 ???로 보인다. 로그도 포함된다. 자동사용되며, 1게임 당 1개씩 사용된다.',
    manual: false,
    trigger: '랭크 게임 매칭 시 자동으로 1개 사용',
  },
  magnifier: {
    emoji: '🔍',
    description: '밴픽 화면에서 각 게임 카드에 상대방의 해당 게임 승률을 표시한다. 익명물약 사용 중에도 확인 가능. 자동사용되며, 1게임 당 1개씩 사용된다.',
    manual: false,
    trigger: '랭크 게임 매칭 시 자동으로 1개 사용',
  },
  ban_eraser: {
    emoji: '🧹',
    description: '밴픽 단계 완료 직후, 상대방이 밴한 게임 1개를 취소하여 추첨 풀에 복귀시킬 수 있다. 복귀된 게임은 추첨 확률이 높아진다. 스킵 시 아이템이 소모되지 않는다.',
    manual: true,
    trigger: '밴픽 완료 후 선택 화면에서 수동 사용',
  },
};

const ORDER: ConsumableKind[] = ['rank_reset', 'nickname_change', 'spectator_lock', 'anonymity', 'magnifier', 'ban_eraser'];

interface RankResetState {
  open: boolean;
  busy: boolean;
}

const AUTO_USE_KINDS = new Set<ConsumableKind>(['spectator_lock', 'anonymity', 'magnifier']);

export default function InventoryCard() {
  const items = useInventoryStore((s) => s.items);
  const autoUse = useInventoryStore((s) => s.autoUse);
  const setOne = useInventoryStore((s) => s.setOne);
  const setAutoUse = useInventoryStore((s) => s.setAutoUse);
  const router = useRouter();
  const [rankReset, setRankReset] = useState<RankResetState>({ open: false, busy: false });

  // 인벤토리 fetch 는 GNB 의 InventoryInit 가 이미 한다 — 여기선 fallback 만.
  useEffect(() => {
    if (items !== null) return;
    let aborted = false;
    fetch('/api/me/consumables', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ items: Array<{ kind: ConsumableKind; count: number; autoUse: boolean }> }>)
      .then((j) => {
        if (aborted) return;
        for (const it of j.items) {
          setOne(it.kind, Number(it.count));
          setAutoUse(it.kind, it.autoUse ?? true);
        }
      })
      .catch(() => {});
    return () => {
      aborted = true;
    };
  }, [items, setOne, setAutoUse]);

  async function toggleAutoUse(kind: ConsumableKind, next: boolean) {
    setAutoUse(kind, next);
    try {
      await fetch('/api/me/consumables/auto-use', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, autoUse: next }),
      });
    } catch {
      setAutoUse(kind, !next);
    }
  }

  const total = useMemo(() => {
    if (!items) return 0;
    return ORDER.reduce((sum, k) => sum + (items[k] ?? 0), 0);
  }, [items]);

  async function confirmRankReset() {
    if (rankReset.busy) return;
    setRankReset({ open: true, busy: true });
    try {
      const res = await fetch('/api/me/rank/reset', { method: 'POST' });
      const json = (await res.json()) as
        | { ok: true; ticketCountAfter: number; usedCountInSeason: number }
        | { error: string; code: string };
      if (!res.ok || !('ok' in json)) {
        const e = json as { error: string };
        toast.error(e.error ?? '랭크 초기화에 실패했어요.');
        return;
      }
      setOne('rank_reset', json.ticketCountAfter);
      toast.success(
        `랭크 진행도를 초기화했어요. (이번 시즌 ${json.usedCountInSeason}/3회 사용)`,
      );
      // 페이지 RSC 다시 받아 RP/티어 표시 즉시 반영.
      router.refresh();
    } catch {
      toast.error('네트워크 오류가 발생했어요.');
    } finally {
      setRankReset({ open: false, busy: false });
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-cdm-fg">
          소모성 인벤토리 <span className="text-cdm-fg-muted">({total})</span>
        </h2>
      </div>
      <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ORDER.map((kind) => {
          const count = items?.[kind] ?? 0;
          const meta = META[kind];
          const label = CONSUMABLE_LABELS[kind];
          const isRankReset = kind === 'rank_reset';
          const isAutoKind = AUTO_USE_KINDS.has(kind);
          const currentAutoUse = autoUse?.[kind] ?? true;
          const toggleDisabled = count <= 0;
          return (
            <li
              key={kind}
              className="rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cdm-fg">
                    <span aria-hidden className="mr-1.5">{meta.emoji}</span>
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-cdm-fg-muted">{meta.description}</p>
                  {meta.trigger && (
                    <p className="mt-0.5 text-[11px] text-cdm-fg-subtle">
                      {meta.manual ? `사용처: ${meta.trigger}` : `자동: ${meta.trigger}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums text-cdm-fg">{count}</p>
                    <p className="text-[10px] text-cdm-fg-subtle">보유</p>
                  </div>
                  {isAutoKind && autoUse !== null && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={currentAutoUse}
                      aria-label={`${label} 자동사용 ${currentAutoUse ? 'ON' : 'OFF'}`}
                      onClick={() => {
                        if (toggleDisabled) {
                          toast.info('보유한 아이템이 없어요.');
                          return;
                        }
                        toggleAutoUse(kind, !currentAutoUse);
                      }}
                      className={[
                        'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer',
                        toggleDisabled
                          ? 'bg-cdm-bg-elev-2 text-cdm-fg-muted'
                          : currentAutoUse
                            ? 'bg-cdm-accent text-white'
                            : 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-block w-2.5 h-2.5 rounded-full transition-colors',
                          currentAutoUse && !toggleDisabled ? 'bg-white' : 'bg-cdm-fg-subtle',
                        ].join(' ')}
                      />
                      {!toggleDisabled && currentAutoUse ? 'ON' : 'OFF'}
                    </button>
                  )}
                </div>
              </div>
              {isRankReset && (
                <Button
                  size="sm"
                  variant={count > 0 ? 'primary' : 'secondary'}
                  disabled={count <= 0}
                  onClick={() => setRankReset({ open: true, busy: false })}
                  fullWidth
                >
                  {count > 0 ? '사용' : '보유 없음'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        open={rankReset.open && !rankReset.busy}
        onClose={() => !rankReset.busy && setRankReset({ open: false, busy: false })}
        title="랭크 초기화권 사용"
        size="sm"
        closeOnBackdrop={!rankReset.busy}
        closeOnEscape={!rankReset.busy}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRankReset({ open: false, busy: false })}
              disabled={rankReset.busy}
            >
              취소
            </Button>
            <Button variant="danger" onClick={confirmRankReset} loading={rankReset.busy}>
              사용하기
            </Button>
          </>
        }
      >
        <p className="text-sm text-cdm-fg">
          진행 중인 시즌의 RP / 티어 / 배치전 진행도가 모두 초기 상태로 돌아가요.
        </p>
        <ul className="mt-2 ml-4 list-disc text-xs text-cdm-fg-muted">
          <li>되돌릴 수 없어요.</li>
          <li>이번 시즌에 최대 3회까지만 사용할 수 있어요.</li>
          <li>매칭 큐에 대기 중이라면 자동으로 큐에서 빠져요.</li>
        </ul>
      </Modal>
    </Card>
  );
}
