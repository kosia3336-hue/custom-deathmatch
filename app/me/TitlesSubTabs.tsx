'use client';

import { useRouter } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/cdm/Tabs';

export default function TitlesSubTabs({
  current,
  titleCount,
  effectCount,
}: {
  current: 'titles' | 'effects';
  titleCount: number;
  effectCount: number;
}) {
  const router = useRouter();
  const tabs: TabItem[] = [
    { id: 'titles', label: '칭호', count: titleCount },
    { id: 'effects', label: '이펙트', count: effectCount },
  ];

  function handleChange(id: string) {
    if (id === 'effects') {
      router.replace('/me?tab=titles&titleSub=effects');
      return;
    }
    router.replace('/me?tab=titles');
  }

  return <Tabs tabs={tabs} value={current} onChange={handleChange} />;
}
