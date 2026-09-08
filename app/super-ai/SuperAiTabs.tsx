'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/cdm/Tabs';

const TABS: TabItem[] = [
  { id: 'play', label: '플레이' },
  { id: 'kifu', label: '기보' },
];

export default function SuperAiTabs({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Tabs
      tabs={TABS}
      value={TABS.find((t) => t.id === current)?.id ?? 'play'}
      onChange={(id) => {
        const params = new URLSearchParams(searchParams.toString());
        if (id === 'play') {
          params.delete('tab');
          params.delete('page');
        } else {
          params.set('tab', id);
        }
        const qs = params.toString();
        router.replace(qs ? `/super-ai?${qs}` : '/super-ai');
      }}
    />
  );
}
