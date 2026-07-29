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
    emoji: '',
    description: '닉네임을 변경할 수 있다.',
    manual: true,
    trigger: '환경 설정 → 닉네임 변경 모달의 "변경권 사용" 체크',
  },
  rank_reset: {
    emoji: '',
    description: '이번 시즌 랭크 전적을 초기화한다. 단, 전체전적은 초기화되지 않는다.',
    manual: true,
  },
  spectator_lock: {
    emoji: '',
    description: '내 게임을 관전할 수 없게 한다. 자동사용되며, 1게임 당 1개씩 사용된다.',
    manual: false,
    trigger: '랭크 게임 매칭 시 자동으로 1개 사용',
  },
  anonymity: {
    emoji: '',
    description: '랭크 게임에서 상대에게 내 닉네임이 ???로 보인다. 로그도 포함된다. 자동사용되며, 1게임 당 1개씩 사용된다.',
    manual: false,
    trigger: '랭크 게임 매칭 시 자동으로 1개 사용',
  },
  magnifier: {
    emoji: '',
    description: '밴픽 화면에서 각 게임 카드에 상대방의 해당 게임 승률을 표시한다. 익명물약 사용 중에도 확인 가능. 자동사용되며, 1게임 당 1개씩 사용된다.',
    manual: false,
    trigger: '랭크 게임 매칭 시 자동으로 1개 사용',
  },
  ban_eraser: {
    emoji: '',
    description: '밴픽 단계 완료 직후, 상대방이 밴한 게임 1개를 취소하여 추첨 풀에 복귀시킬 수 있다. 복귀된 게임은 추첨 확률이 높아진다. 스킵 시 아이템이 소모되지 않는다.',
    manual: true,
    trigger: '밴픽 완료 후 선택 화면에서 수동 사용',
  },
  gacha_box: {
    emoji: '',
    description: '개봉하면 뽑기권 1~5장을 랜덤으로 획득한다. 랭크에서 하루 5승 시 1개 증정.',
    manual: true,
    trigger: '인벤토리에서 "개봉"',
  },
  gacha_ticket: {
    emoji: '',
    description: 'CDP 없이 뽑기를 1회 돌릴 수 있다. (상품 구성은 일반 뽑기와 동일)',
    manual: true,
    trigger: '상점 → 뽑기 탭에서 "뽑기권으로 뽑기"',
  },
  guild_charter: {
    emoji: '',
    description: '새로운 길드를 창설할 수 있는 증서. 길드 페이지에서 사용한다.',
    manual: true,
    trigger: '길드 페이지 → "길드 창설"',
  },
  word_search: {
    emoji: '',
    description: "'단어조합' 게임에서 입력한 단어가 실제 사전에 있는 단어인지 검색할 수 있다(게임 내내 무제한). 자동사용되며, '단어조합' 1게임 당 1개씩 사용된다.",
    manual: false,
    trigger: "'단어조합' 게임 시작 시 자동으로 1개 사용",
  },
};

const ORDER: ConsumableKind[] = ['gacha_box', 'gacha_ticket', 'guild_charter', 'rank_reset', 'nickname_change', 'spectator_lock', 'anonymity', 'magnifier', 'word_search', 'ban_eraser'];

interface RankResetState {
  open: boolean;
  busy: boolean;
}

const AUTO_USE_KINDS = new Set<ConsumableKind>(['spectator_lock', 'anonymity', 'magnifier', 'word_search']);

/** 판매 가능한 소모품 (뽑기 박스·뽑기권 제외) */
const SELLABLE_KINDS = new Set<ConsumableKind>([
  'nickname_change',
  'rank_reset',
  'spectator_lock',
  'anonymity',
  'magnifier',
  'word_search',
  'ban_eraser',
]);

export default function InventoryCard() {
  const items = useInventoryStore((s) => s.items);
  const autoUse = useInventoryStore((s) => s.autoUse);
  const setOne = useInventoryStore((s) => s.setOne);
  const setAutoUse = useInventoryStore((s) => s.setAutoUse);
  const router = useRouter();
  const [rankReset, setRankReset] = useState<RankResetState>({ open: false, busy: false });
  const [sell, setSell] = useState<{ open: boolean; kind: ConsumableKind | null; quantity: number; busy: boolean }>({
    open: false,
    kind: null,
    quantity: 1,
    busy: false,
  });
  const [boxBusy, setBoxBusy] = useState(false);

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

  function openSell(kind: ConsumableKind) {
    setSell({ open: true, kind, quantity: 1, busy: false });
  }

  async function openBox() {
    if (boxBusy) return;
    setBoxBusy(true);
    try {
      const res = await fetch('/api/shop/gacha-box/open', { method: 'POST' });
      const json = (await res.json()) as
        | { ok: true; ticketsGranted: number; boxCountAfter: number; ticketCountAfter: number }
        | { error: string; code: string };
      if (!res.ok || !('ok' in json)) {
        toast.error((json as { error: string }).error ?? '개봉에 실패했어요.');
        return;
      }
      setOne('gacha_box', json.boxCountAfter);
      setOne('gacha_ticket', json.ticketCountAfter);
      toast.success(`뽑기 박스 개봉! 뽑기권 ${json.ticketsGranted}장을 획득했어요.`);
    } catch {
      toast.error('네트워크 오류가 발생했어요.');
    } finally {
      setBoxBusy(false);
    }
  }

  const sellMax = sell.kind ? (items?.[sell.kind] ?? 0) : 0;

  async function confirmSell() {
    if (sell.busy || !sell.kind) return;
    const kind = sell.kind;
    const quantity = Math.min(Math.max(1, sell.quantity), Math.max(1, sellMax));
    setSell((s) => ({ ...s, busy: true }));
    try {
      const res = await fetch('/api/shop/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, quantity }),
      });
      const json = (await res.json()) as
        | { ok: true; refund: number; unitRefund: number; newBalance: number; countAfter: number }
        | { error: string; code: string };
      if (!res.ok || !('ok' in json)) {
        toast.error((json as { error: string }).error ?? '판매에 실패했어요.');
        return;
      }
      setOne(kind, json.countAfter);
      toast.success(
        `${CONSUMABLE_LABELS[kind]} ${quantity}개를 판매하고 ${json.refund.toLocaleString()} CDP를 받았어요.`,
      );
      // CDP 요약 등 RSC 즉시 반영
      router.refresh();
      setSell({ open: false, kind: null, quantity: 1, busy: false });
    } catch {
      toast.error('네트워크 오류가 발생했어요.');
    } finally {
      setSell((s) => ({ ...s, busy: false }));
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
              {(isRankReset || count > 0) && (
                <div className="flex gap-2">
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
                  {kind === 'gacha_box' && count > 0 && (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={boxBusy}
                      onClick={openBox}
                      fullWidth
                    >
                      개봉
                    </Button>
                  )}
                  {kind === 'gacha_ticket' && count > 0 && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => router.push('/shop?type=gacha')}
                      fullWidth
                    >
                      뽑기하러 가기
                    </Button>
                  )}
                  {count > 0 && SELLABLE_KINDS.has(kind) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openSell(kind)}
                      fullWidth
                    >
                      판매
                    </Button>
                  )}
                </div>
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

      {sell.open && sell.kind && (
        <Modal
          open={sell.open}
          onClose={() => !sell.busy && setSell({ open: false, kind: null, quantity: 1, busy: false })}
          title="아이템 판매"
          size="sm"
          closeOnBackdrop={!sell.busy}
          closeOnEscape={!sell.busy}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setSell({ open: false, kind: null, quantity: 1, busy: false })}
                disabled={sell.busy}
              >
                취소
              </Button>
              <Button variant="primary" onClick={confirmSell} loading={sell.busy}>
                판매하기
              </Button>
            </>
          }
        >
          <p className="text-sm text-cdm-fg">
            <span className="font-semibold">{CONSUMABLE_LABELS[sell.kind]}</span> 을(를) 판매해요.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3">
            <span className="text-sm text-cdm-fg-muted">판매 수량</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="수량 감소"
                disabled={sell.busy || sell.quantity <= 1}
                onClick={() => setSell((s) => ({ ...s, quantity: Math.max(1, s.quantity - 1) }))}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-cdm-border text-cdm-fg disabled:opacity-40 cursor-pointer"
              >
                −
              </button>
              <span className="min-w-8 text-center text-base font-bold tabular-nums text-cdm-fg">
                {sell.quantity}
              </span>
              <button
                type="button"
                aria-label="수량 증가"
                disabled={sell.busy || sell.quantity >= sellMax}
                onClick={() => setSell((s) => ({ ...s, quantity: Math.min(sellMax, s.quantity + 1) }))}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-cdm-border text-cdm-fg disabled:opacity-40 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
          <ul className="mt-2 ml-4 list-disc text-xs text-cdm-fg-muted">
            <li>구매가의 10%가 CDP로 환급돼요.</li>
            <li>보유 수량: {sellMax}개</li>
            <li>되돌릴 수 없어요.</li>
          </ul>
        </Modal>
      )}
    </Card>
  );
}
