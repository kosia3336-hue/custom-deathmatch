'use client';

import { useRouter } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/cdm/Tabs';

const TABS: TabItem[] = [
  { id: 'dashboard', label: '대시보드' },
  { id: 'members', label: '회원' },
  { id: 'guilds', label: '길드' },
  { id: 'titles', label: '칭호' },
  { id: 'rank', label: '랭크' },
  { id: 'shop', label: '상점' },
  { id: 'game-stats', label: '게임' },
  { id: 'game-rules', label: '게임 룰' },
  { id: 'reports', label: '신고' },
  { id: 'inquiries', label: '문의' },
  { id: 'notices', label: '공지' },
  { id: 'audit', label: '관리자 로그' },
];

export default function AdminTabs({ current }: { current: string }) {
  const router = useRouter();
  return (
    <Tabs
      tabs={TABS}
      value={TABS.find((t) => t.id === current)?.id ?? 'dashboard'}
      onChange={(id) => router.replace(id === 'dashboard' ? '/admin' : `/admin?tab=${id}`)}
    />
  );
}
