'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { ChuseokSkinPickModal, ChuseokSkinRevealModal } from './ChuseokSkinGrant';
import { SKIN_REGISTRY, type SkinMeta } from '@/lib/skins/registry';
import { CHUSEOK_SKIN_TICKET_POOL } from '@shared/event/chuseok';
import { playSkinReelSfx } from '@/lib/sfx';

interface Props {
  items: ShopItem[];
  ownedIds: string[];
  initialBalance: number;
  initialType: string;
  /** 거상 칭호 보유 + 시즌 활성 → 모든 가격 10% 할인 표시 */
  merchantDiscount: boolean;
  /** 넘기면 추석 탭을 이 목록으로 대체한다. */
  chuseokItems?: ShopItem[];
  /** 송편 잔액. 운영 상점은 구매 API 결과로 갱신한다. */
  songpyeonBalance?: number;
  ownedSkinIds?: string[];
  pendingSkinPick?: { pendingId: string; itemId: string } | null;
  onSongpyeonBalanceChange?: (next: number) => void;
  onLocalCdpBalance?: (next: number) => void;
}

interface ItemChangedPayload {
  itemId: string;
  stock: number | null;
  isActive: boolean;
}

// 이벤트 기간 종료 — 재개 시 | 'event_chip_pack' 추가
type TabId = 'all' | 'consumable' | 'title' | 'gacha' | 'chuseok';

const TAB_FOR_TYPE: Record<string, TabId> = {
  consumable: 'consumable',
  title: 'title',
  // event_chip_pack: 'event_chip_pack', // 이벤트 기간 종료
};

function isSongpyeonItem(item: ShopItem): boolean {
  return (item.payload ?? {}).priceUnit === 'songpyeon';
}

function effectivePrice(price: number, discount: boolean): number {
  if (!discount) return price;
  return Math.floor(price * 0.9);
}

function ticketSkins(ownedIds: Iterable<string>): SkinMeta[] {
  const owned = new Set(ownedIds);
  return CHUSEOK_SKIN_TICKET_POOL.map((id) => SKIN_REGISTRY[id]).filter(
    (skin): skin is SkinMeta => Boolean(skin) && !owned.has(skin.id),
  );
}

export default function ShopClient({
  items: initialItems,
  ownedIds,
  initialBalance,
  initialType,
  merchantDiscount,
  chuseokItems = [],
  songpyeonBalance = 0,
  ownedSkinIds = [],
  pendingSkinPick = null,
  onSongpyeonBalanceChange,
  onLocalCdpBalance,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const setBalance = useCdpStore((s) => s.setBalance);
  const balance = useCdpStore((s) => s.balance) ?? initialBalance;
  const setEventChipBalance = useEventChipsStore((s) => s.setBalance);

  const previewShop = chuseokItems.some((item) => (item.payload ?? {}).preview === true);
  const [items, setItems] = useState<ShopItem[]>(() =>
    initialItems.filter((item) => !isSongpyeonItem(item)),
  );
  const [festival, setFestival] = useState<ShopItem[]>(() =>
    previewShop ? chuseokItems : initialItems.filter(isSongpyeonItem),
  );
  const [ownedSkins, setOwnedSkins] = useState<string[]>(ownedSkinIds);
  const [songpyeon, setSongpyeon] = useState(songpyeonBalance);
  const livePick = useRef<{ pendingId: string; itemId: string; cost: number } | null>(null);
  const [pickPool, setPickPool] = useState<SkinMeta[] | null>(null);
  const [revealedSkin, setRevealedSkin] = useState<SkinMeta | null>(null);
  const [reelPool, setReelPool] = useState<SkinMeta[]>([]);
  const pickRefund = useRef<{ itemId: string; cost: number } | null>(null);
  const [owned, setOwned] = useState<Set<string>>(() => new Set(ownedIds));
  const [heldPick, setHeldPick] = useState<{ pendingId: string; itemId: string } | null>(null);
  const festivalIds = useRef(new Set(festival.map((item) => item.id)));
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (
      initialType === 'consumable' ||
      initialType === 'title' ||
      initialType === 'gacha' ||
      (initialType === 'chuseok' && (chuseokItems.length > 0 || initialItems.some(isSongpyeonItem)))
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
    setSongpyeon(songpyeonBalance);
  }, [songpyeonBalance]);

  function publishSongpyeon(next: number) {
    setSongpyeon(next);
    onSongpyeonBalanceChange?.(next);
    window.dispatchEvent(new CustomEvent('cdm:songpyeon', { detail: { balance: next } }));
  }

  const openedPending = useRef(false);
  useEffect(() => {
    if (openedPending.current || !pendingSkinPick) return;
    const item = festival.find((entry) => entry.id === pendingSkinPick.itemId);
    if (!item) return;
    openedPending.current = true;
    livePick.current = {
      pendingId: pendingSkinPick.pendingId,
      itemId: pendingSkinPick.itemId,
      cost: item.price,
    };
    setPickPool(ticketSkins(ownedSkinIds));
  }, [pendingSkinPick, festival, ownedSkinIds]);

  useEffect(() => {
    festivalIds.current = new Set(festival.map((item) => item.id));
  }, [festival]);

  useEffect(() => {
    const socket = getSocket();
    const onChanged = (p: ItemChangedPayload) => {
      setItems((prev) => {
        const idx = prev.findIndex((it) => it.id === p.itemId);
        if (idx < 0) {
          if (p.isActive && !festivalIds.current.has(p.itemId)) router.refresh();
          return prev;
        }
        if (!p.isActive) {
          return prev.filter((it) => it.id !== p.itemId);
        }
        const next = [...prev];
        next[idx] = { ...next[idx]!, stock: p.stock };
        return next;
      });
      setFestival((prev) => {
        const idx = prev.findIndex((it) => it.id === p.itemId);
        if (idx < 0) return prev;
        if (!p.isActive) return prev.filter((it) => it.id !== p.itemId);
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
      { id: 'consumable', label: '소모성', count: cConsumable },
      { id: 'title', label: '칭호', count: cTitle },
      { id: 'gacha', label: '뽑기' },
      // { id: 'event_chip_pack', label: '이벤트', count: cChip }, // 이벤트 기간 종료
      ...(festival.length > 0
        ? [{ id: 'chuseok', label: '추석', count: festival.length }]
        : []),
    ];
  }, [items, festival.length]);

  const visibleItems = useMemo(() => {
    if (activeTab === 'chuseok') return festival;
    if (activeTab === 'all') return items;
    return items.filter((it) => TAB_FOR_TYPE[it.type] === activeTab);
  }, [items, activeTab, festival]);

  function handleTabChange(id: string) {
    const next = id as TabId;
    if (next !== 'gacha') setGachaOpen(false);
    setActiveTab(next);
    const qs = new URLSearchParams(sp?.toString() ?? '');
    if (next === 'all') qs.delete('type');
    else qs.set('type', next);
    const s = qs.toString();
    router.replace(s ? `${pathname}?${s}` : pathname);
  }

  async function handleConfirmPurchase(item: ShopItem, quantity: number): Promise<boolean> {
    const songpyeonPay = (item.payload ?? {}) as {
      priceUnit?: string;
      exchangeCdp?: number;
      grant?: string;
      preview?: boolean;
    };
    if (songpyeonPay.priceUnit === 'songpyeon' && songpyeonPay.preview === true) {
      const cost = item.price * quantity;
      if (songpyeon < cost) {
        toast.error(`송편이 부족합니다. 필요 ${formatCdp(cost)} / 보유 ${formatCdp(songpyeon)}`);
        return false;
      }
      if (item.stock !== null && item.stock < quantity) {
        toast.error('수량이 부족합니다.');
        return false;
      }
      const pool = ticketSkins(ownedSkins);
      if ((songpyeonPay.grant === 'skin-pick' || songpyeonPay.grant === 'skin-random') && pool.length === 0) {
        toast.error('고를 수 있는 스킨이 없습니다.');
        return false;
      }
      publishSongpyeon(songpyeon - cost);
      if (songpyeonPay.grant === 'skin-random') {
        const skin = pool[Math.floor(Math.random() * pool.length)]!;
        playSkinReelSfx();
        setOwnedSkins((prev) => [...prev, skin.id]);
        setReelPool(pool);
        setRevealedSkin(skin);
      } else if (songpyeonPay.grant === 'skin-pick') {
        livePick.current = null;
        pickRefund.current = { itemId: item.id, cost };
        setPickPool(pool);
      } else if (typeof songpyeonPay.exchangeCdp === 'number') {
        const gained = songpyeonPay.exchangeCdp * quantity;
        const nextCdp = balance + gained;
        setBalance(nextCdp);
        onLocalCdpBalance?.(nextCdp);
        toast.success(`송편 ${formatCdp(cost)}개 → ${formatCdp(gained)} CDP`);
      } else {
        toast.success(`${item.name} 구매 완료. 송편 ${formatCdp(songpyeon - cost)}개`);
      }
      setFestival((prev) =>
        prev.map((it) =>
          it.id === item.id && it.stock !== null ? { ...it, stock: it.stock - quantity } : it,
        ),
      );
      return true;
    }
    if (songpyeonPay.priceUnit === 'songpyeon') {
      const pool = ticketSkins(ownedSkins);
      try {
        const res = await fetch('/api/shop/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, quantity }),
        });
        const json = (await res.json()) as PurchaseSuccess | PurchaseError;
        if (!res.ok || !('ok' in json)) {
          const e = json as PurchaseError;
          if (e.code === 'insufficient_songpyeon' || e.code === 'insufficient_balance') {
            toast.error('송편이 부족합니다.');
          } else if (e.code === 'out_of_stock') {
            toast.error('방금 품절됐습니다.');
            setFestival((prev) => prev.map((it) => (it.id === item.id ? { ...it, stock: 0 } : it)));
          } else if (e.code === 'no_skins_left') {
            toast.error('고를 수 있는 스킨이 없습니다.');
          } else if (e.code === 'item_expired') {
            toast.error('한가위 상점이 끝났습니다.');
          } else if (e.code === 'already_owned') {
            toast.error('이미 보유하고 있습니다.');
            setOwned((prev) => {
              const next = new Set(prev);
              next.add(item.id);
              return next;
            });
            return true;
          } else {
            toast.error(e.error ?? '구매에 실패했습니다.');
          }
          return e.code === 'out_of_stock';
        }
        const ok = json as PurchaseSuccess;
        if (typeof ok.songpyeonBalance === 'number') publishSongpyeon(ok.songpyeonBalance);
        if (typeof ok.newBalance === 'number' && songpyeonPay.exchangeCdp != null) {
          setBalance(ok.newBalance);
          onLocalCdpBalance?.(ok.newBalance);
          toast.success(
            `송편 ${formatCdp(ok.pricePaid)}개 → ${formatCdp((songpyeonPay.exchangeCdp ?? 0) * quantity)} CDP`,
          );
        }
        setFestival((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, stock: ok.stockAfter ?? it.stock } : it)),
        );
        if (ok.grant === 'skin-random' && ok.skinId) {
          const skin = pool.find((entry) => entry.id === ok.skinId) ?? SKIN_REGISTRY[ok.skinId];
          if (skin) {
            playSkinReelSfx();
            setOwnedSkins((prev) => [...prev, skin.id]);
            setReelPool(pool);
            setRevealedSkin(skin);
          }
        } else if (ok.grant === 'skin-pick' && ok.pendingId) {
          livePick.current = { pendingId: ok.pendingId, itemId: item.id, cost: ok.pricePaid };
          pickRefund.current = null;
          setPickPool(pool);
        } else if (songpyeonPay.exchangeCdp == null) {
          toast.success(`${item.name} 구매 완료. 송편 ${formatCdp(ok.songpyeonBalance ?? 0)}개`);
          setOwned((prev) => {
            const n = new Set(prev);
            n.add(item.id);
            return n;
          });
        }
        return true;
      } catch {
        toast.error('네트워크 오류가 발생했습니다.');
        return false;
      }
    }

    const expected = effectivePrice(item.price, hasMerchantDiscount) * quantity;
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, quantity }),
      });
      const json = (await res.json()) as PurchaseSuccess | PurchaseError;
      if (!res.ok || !('ok' in json)) {
        const e = json as PurchaseError;
        switch (e.code) {
          case 'insufficient_balance':
            toast.error(`CDP 가 부족합니다. 필요 ${formatCdp(expected)} / 보유 ${formatCdp(balance)}`);
            return false;
          case 'out_of_stock':
            toast.error('방금 품절됐습니다.');
            setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, stock: 0 } : it)));
            return true;
          case 'already_owned':
            toast.error('이미 보유하고 있습니다.');
            setOwned((prev) => {
              const n = new Set(prev);
              n.add(item.id);
              return n;
            });
            return true;
          case 'item_inactive':
          case 'item_expired':
            toast.error('판매가 종료된 아이템입니다.');
            setItems((prev) => prev.filter((it) => it.id !== item.id));
            return true;
          default:
            toast.error(e.error ?? '구매에 실패했습니다.');
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
          `이벤트 칩 +${ok.grantedChips ?? 0}개! 보유 ${ok.newChipBalance}칩 / CDP ${formatCdp(ok.newBalance)}`,
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
      toast.error('네트워크 오류가 발생했습니다.');
      return false;
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {hasMerchantDiscount && (
        <div className="rounded-cdm-md border border-cdm-primary/40 bg-cdm-primary/10 px-3 py-2 text-sm text-cdm-fg">
          <strong>최초의 거상</strong> 효과로 모든 상점 아이템이 <b>10% 할인</b> 적용 중입니다. (시즌 종료 시까지)
        </div>
      )}

      <Tabs tabs={tabs} value={activeTab} onChange={handleTabChange} />

      {/* 이벤트 기간 종료 — 재개 시 주석 해제
      {activeTab === 'event_chip_pack' && <ShopEventChipExchange />}
      */}

      {activeTab === 'gacha' ? (
        <ShopGachaTab balance={balance} onOpen={() => setGachaOpen(true)} />
      ) : activeTab === 'chuseok' ? (
        <>
          {heldPick && pickPool === null && (
            <div className="flex items-center justify-between gap-3 rounded-cdm-md border border-cdm-border px-3 py-2">
              <p className="text-sm text-cdm-fg">고르지 않은 스킨 영구 선택권이 있습니다.</p>
              <button
                type="button"
                className="shrink-0 text-sm font-semibold text-cdm-primary"
                onClick={() => {
                  const item = festival.find((entry) => entry.id === heldPick.itemId);
                  livePick.current = {
                    pendingId: heldPick.pendingId,
                    itemId: heldPick.itemId,
                    cost: item?.price ?? 0,
                  };
                  setPickPool(ticketSkins(ownedSkins));
                }}
              >
                스킨 고르기
              </button>
            </div>
          )}
          <ChuseokShelf
          items={visibleItems}
          owned={owned}
          balance={balance}
          songpyeonBalance={songpyeon}
          merchantDiscount={hasMerchantDiscount}
          onBuy={setOpenItem}
        />
        </>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={activeTab === 'all' ? '아직 판매 중인 아이템이 없습니다' : '이 카테고리에는 아이템이 없습니다'}
          description={activeTab === 'all' ? '곧 첫 아이템이 등록될 예정입니다!' : undefined}
        />
      ) : (
        <ShopItemGrid
          items={visibleItems}
          owned={owned}
          balance={balance}
          merchantDiscount={hasMerchantDiscount}
          onBuy={setOpenItem}
        />
      )}

      <ShopPurchaseModal
        item={openItem}
        balance={balance}
        songpyeonBalance={songpyeon}
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

      <ChuseokSkinPickModal
        skins={pickPool}
        onPick={(skin) => {
          const pending = livePick.current;
          if (!pending) {
            setOwnedSkins((prev) => [...prev, skin.id]);
            pickRefund.current = null;
            setPickPool(null);
            toast.success(`${skin.name} 스킨을 영구 획득했습니다.`);
            return;
          }
          void fetch('/api/shop/songpyeon/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendingId: pending.pendingId, skinId: skin.id }),
          }).then(async (res) => {
            if (!res.ok) {
              toast.error('스킨을 받지 못했습니다.');
              return;
            }
            livePick.current = null;
            setHeldPick(null);
            setOwnedSkins((prev) => [...prev, skin.id]);
            setPickPool(null);
            toast.success(`${skin.name} 스킨을 영구 획득했습니다.`);
          });
        }}
        onClose={() => {
          const pending = livePick.current;
          const refund = pickRefund.current;
          livePick.current = null;
          pickRefund.current = null;
          setPickPool(null);
          if (pending) {
            setHeldPick({ pendingId: pending.pendingId, itemId: pending.itemId });
            return;
          }
          if (!refund) return;
          publishSongpyeon(songpyeon + refund.cost);
          setFestival((prev) =>
            prev.map((it) =>
              it.id === refund.itemId && it.stock !== null ? { ...it, stock: it.stock + 1 } : it,
            ),
          );
        }}
      />
      <ChuseokSkinRevealModal
        skin={revealedSkin}
        pool={reelPool}
        onClose={() => setRevealedSkin(null)}
      />
    </section>
  );
}

const CHUSEOK_SHELF = [
  { type: 'title', label: '칭호' },
  { type: 'effect', label: '이펙트' },
  { type: 'skin', label: '스킨' },
  { type: 'exchange', label: '환전' },
] as const;

function ChuseokShelf({
  items,
  owned,
  balance,
  songpyeonBalance,
  merchantDiscount,
  onBuy,
}: {
  items: ShopItem[];
  owned: Set<string>;
  balance: number;
  songpyeonBalance: number;
  merchantDiscount: boolean;
  onBuy: (item: ShopItem) => void;
}) {
  const groups = CHUSEOK_SHELF.map((group) => ({
    ...group,
    items: items.filter((item) => item.type === group.type),
  })).filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return <EmptyState title="이 카테고리에는 아이템이 없습니다" />;
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.type} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="shrink-0 text-sm font-semibold text-cdm-fg">{group.label}</h2>
            <hr className="min-w-0 flex-1 border-cdm-border" />
          </div>
          <ShopItemGrid
            items={group.items}
            owned={owned}
            balance={balance}
            songpyeonBalance={songpyeonBalance}
            merchantDiscount={merchantDiscount}
            onBuy={onBuy}
          />
        </section>
      ))}
    </div>
  );
}

function ShopItemGrid({
  items,
  owned,
  balance,
  songpyeonBalance = 0,
  merchantDiscount,
  onBuy,
}: {
  items: ShopItem[];
  owned: Set<string>;
  balance: number;
  songpyeonBalance?: number;
  merchantDiscount: boolean;
  onBuy: (item: ShopItem) => void;
}) {
  return (
    <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <li key={it.id}>
          <ShopItemCard
            item={it}
            owned={owned.has(it.id)}
            balance={balance}
            songpyeonBalance={songpyeonBalance}
            merchantDiscount={merchantDiscount}
            onBuy={() => onBuy(it)}
          />
        </li>
      ))}
    </ul>
  );
}
