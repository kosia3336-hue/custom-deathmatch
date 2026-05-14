'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/cdm/Tabs';

const TABS: TabItem[] = [
  { id: 'items', label: '아이템' },
  { id: 'cdp', label: 'CDP 조정' },
  { id: 'consumables', label: '소모성 조정' },
];

export default function AdminShopSubTabs({ current }: { current: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  function handleChange(id: string) {
    const next = new URLSearchParams(sp?.toString() ?? '');
    next.set('tab', 'shop');
    if (id === 'items') next.delete('shopSubTab');
    else next.set('shopSubTab', id);
    router.replace(`/admin?${next.toString()}`);
  }

  return <Tabs tabs={TABS} value={current} onChange={handleChange} />;
}
