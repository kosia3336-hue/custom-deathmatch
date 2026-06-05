'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Tabs, type TabItem } from '@/components/cdm/Tabs';
import { EmptyState } from '@/components/cdm/EmptyState';
import { useCdpStore } from '@/stores/cdp';
import { useEventChipsStore } from '@/stores/eventChips';
import { getSocket } from '@/lib/socket';
import type { ShopItem, PurchaseSuccess, PurchaseError } from '@/lib/cdp/types';
import { formatCdp } from '@/lib/cdp/format';
import ShopItemCard from './ShopItemCard';
import ShopPurchaseModal from './ShopPurchaseModal';
import ShopGachaTab from './ShopGachaTab';
import ShopGachaModal from './ShopGachaModal';
import ShopEventChipExchange from './ShopEventChipExchange';

interface Props {
  items: ShopItem[];
  ownedIds: string[];
  initialBalance: number;
  initialType: string;
  /** 거상 칭호 보유 + 시즌 활성 → 모든 가격 10% 할인 표시 */
  merchantDiscount: boolean;
}

interface ItemChangedPayload {
  itemId: string;
  stock: number | null;
  isActive: boolean;
}

// 이벤트 기간 종료 — 재개 시 | 'event_chip_pack' 추가
type TabId = 'all' | 'consumable' | 'title' | 'gacha';

const TAB_FOR_TYPE: Record<string, TabId> = {
  consumable: 'consumable',
  title: 'title',
  // event_chip_pack: 'event_chip_pack', // 이벤트 기간 종료
};

function effectivePrice(price: number, discount: boolean): number {
  if (!discount) return price;
  return Math.floor(price * 0.9);
}

export default function ShopClient({
  items: initialItems,
  ownedIds,
  initialBalance,
  initialType,
  merchantDiscount,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const setBalance = useCdpStore((s) => s.setBalance);
  const balance = useCdpStore((s) => s.balance) ?? initialBalance;
  const setEventChipBalance = useEventChipsStore((s) => s.setBalance);

  const [items, setItems] = useState<ShopItem[]>(initialItems);
  const [owned, setOwned] = useState<Set<string>>(() => new Set(ownedIds));
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (
      initialType === 'consumable' ||
      initialType === 'title' ||
      initialType === 'gacha'
      // || initialType === 'event_chip_pack' // 이벤트 기간 종료
    ) {
      return initialType as TabId;
    }
    return 'all';
  });
  const [openItem, setOpenItem] = useState<ShopItem | null>(null);
  const [gachaOpen, setGachaOpen] = useState(false);
  const [hasMerchantDiscount, setHasMerchantDiscount] = useState(merchantDiscount);

  useEffect(() => {
    setBalance(initialBalance);
  }, [initialBalance, setBalance]);

  useEffect(() => {
    const socket = getSocket();
    const onChanged = (p: ItemChangedPayload) => {
      setItems((prev) => {
        const idx = prev.findIndex((it) => it.id === p.itemId);
        if (idx < 0) {
          if (p.isActive) router.refresh();
          return prev;
        }
        if (!p.isActive) {
          return prev.filter((it) => it.id !== p.itemId);
        }
        const next = [...prev];
        next[idx] = { ...next[idx]!, stock: p.stock };
        return next;
      });
    };
    socket.on('shop:item_changed', onChanged);
    return () => {
      socket.off('shop:item_changed', onChanged);
    };
  }, [router]);

  const tabs: TabItem[] = useMemo(() => {
    const cConsumable = items.filter((i) => TAB_FOR_TYPE[i.type] === 'consumable').length;
    const cTitle = items.filter((i) => TAB_FOR_TYPE[i.type] === 'title').length;
    // const cChip = items.filter((i) => TAB_FOR_TYPE[i.type] === 'event_chip_pack').length; // 이벤트 기간 종료
    return [
      { id: 'all', label: '전체', count: items.length },
      { id: 'consumable', label: '🎟 소모성', count: cConsumable },
      { id: 'title', label: '🏆 칭호', count: cTitle },
      { id: 'gacha', label: '🎲 뽑기' },
      // { id: 'event_chip_pack', label: '🪙 이벤트', count: cChip }, // 이벤트 기간 종료
    ];
  }, [items]);

  const visibleItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((it) => TAB_FOR_TYPE[it.type] === activeTab);
  }, [items, activeTab]);

  function handleTabChange(id: string) {
    const next = id as TabId;
    if (next !== 'gacha') setGachaOpen(false);
    setActiveTab(next);
    const qs = new URLSearchParams(sp?.toString() ?? '');
    if (next === 'all') qs.delete('type');
    else qs.set('type', next);
    const s = qs.toString();
    router.replace(s ? `/shop?${s}` : '/shop');
  }

  async function handleConfirmPurchase(item: ShopItem): Promise<boolean> {
    const expected = effectivePrice(item.price, hasMerchantDiscount);
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const json = (await res.json()) as PurchaseSuccess | PurchaseError;
      if (!res.ok || !('ok' in json)) {
        const e = json as PurchaseError;
        switch (e.code) {
          case 'insufficient_balance':
            toast.error(`CDP 가 부족해요. 필요 ${formatCdp(expected)} / 보유 ${formatCdp(balance)}`);
            return false;
          case 'out_of_stock':
            toast.error('방금 품절됐어요.');
            setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, stock: 0 } : it)));
            return true;
          case 'already_owned':
            toast.error('이미 보유하고 있어요.');
            setOwned((prev) => {
              const n = new Set(prev);
              n.add(item.id);
              return n;
            });
            return true;
          case 'item_inactive':
          case 'item_expired':
            toast.error('판매가 종료된 아이템이에요.');
            setItems((prev) => prev.filter((it) => it.id !== item.id));
            return true;
          default:
            toast.error(e.error ?? '구매에 실패했어요.');
            return false;
        }
      }

      const ok = json as PurchaseSuccess;
      setBalance(ok.newBalance);

      // 이벤트 칩 팩이면 보유 갱신은 스킵 (반복 구매 허용), 칩 잔액만 갱신
      const payload = (item.payload ?? {}) as { kind?: string };
      const isEventChipPack = payload.kind === 'event_chip_pack' || ok.kind === 'event_chip_pack';

      if (!isEventChipPack) {
        setOwned((prev) => {
          const n = new Set(prev);
          n.add(item.id);
          return n;
        });
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, stock: ok.stockAfter ?? it.stock } : it,
        ),
      );

      // 거상 칭호 신규 부여 시 즉시 할인 적용 ON
      if (payload.kind === 'first_merchant') {
        setHasMerchantDiscount(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cdm:merchant-discount', { detail: { active: true } }),
          );
        }
      }

      if (isEventChipPack && typeof ok.newChipBalance === 'number') {
        setEventChipBalance(ok.newChipBalance);
        toast.success(
          `🪙 이벤트 칩 +${ok.grantedChips ?? 0}개! 보유 ${ok.newChipBalance}칩 / CDP ${formatCdp(ok.newBalance)}`,
        );
        return true;
      }

      const dispPrice = ok.pricePaid ?? expected;
      const discounted = ok.discountApplied && ok.discountApplied > 0;
      toast.success(
        discounted
          ? `${item.name} 구매 완료! (할인 -${formatCdp(ok.discountApplied!)}) 잔액 ${formatCdp(ok.newBalance)} CDP`
          : `${item.name} 구매 완료! 잔액 ${formatCdp(ok.newBalance)} CDP`,
      );
      void dispPrice;
      return true;
    } catch {
      toast.error('네트워크 오류가 발생했어요.');
      return false;
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {hasMerchantDiscount && (
        <div className="rounded-cdm-md border border-cdm-primary/40 bg-cdm-primary/10 px-3 py-2 text-sm text-cdm-fg">
          <span className="mr-1.5">💰</span>
          <strong>최초의 거상</strong> 효과로 모든 상점 아이템이 <b>10% 할인</b> 적용 중이에요. (시즌 종료 시까지)
        </div>
      )}

      <Tabs tabs={tabs} value={activeTab} onChange={handleTabChange} />

      {/* 이벤트 기간 종료 — 재개 시 주석 해제
      {activeTab === 'event_chip_pack' && <ShopEventChipExchange />}
      */}

      {activeTab === 'gacha' ? (
        <ShopGachaTab balance={balance} onOpen={() => setGachaOpen(true)} />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={activeTab === 'all' ? '아직 판매 중인 아이템이 없어요' : '이 카테고리에는 아이템이 없어요'}
          description={activeTab === 'all' ? '곧 첫 아이템이 등록될 예정이에요!' : undefined}
        />
      ) : (
        <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {visibleItems.map((it) => (
            <li key={it.id}>
              <ShopItemCard
                item={it}
                owned={owned.has(it.id)}
                balance={balance}
                merchantDiscount={hasMerchantDiscount}
                onBuy={() => setOpenItem(it)}
              />
            </li>
          ))}
        </ul>
      )}

      <ShopPurchaseModal
        item={openItem}
        balance={balance}
        merchantDiscount={hasMerchantDiscount}
        onClose={() => setOpenItem(null)}
        onConfirm={handleConfirmPurchase}
      />

      <ShopGachaModal
        open={gachaOpen}
        onClose={() => setGachaOpen(false)}
        balance={balance}
        onBalanceChange={setBalance}
      />
    </section>
  );
}
