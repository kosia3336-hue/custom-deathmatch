'use client';

import { useRouter } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/cdm/Tabs';

const TABS: TabItem[] = [
  { id: 'overview', label: '개요' },
  { id: 'logs', label: '게임 로그' },
  { id: 'stats', label: '전적' },
  { id: 'titles', label: '보유 칭호' },
  { id: 'shop', label: '인벤토리' },
  { id: 'support', label: '문의' },
  { id: 'settings', label: '설정' },
];

export default function MyPageTabs({ current }: { current: string }) {
  const router = useRouter();
  return (
    <Tabs
      tabs={TABS}
      value={TABS.find((t) => t.id === current)?.id ?? 'overview'}
      onChange={(id) => router.replace(id === 'overview' ? '/me' : `/me?tab=${id}`)}
    />
  );
}
