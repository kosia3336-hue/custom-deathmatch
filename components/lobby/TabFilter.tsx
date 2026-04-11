'use client';

import { cn } from '@/lib/utils';
import { useLobbyStore, type TabFilter as TF } from '@/stores/lobby';

const TABS: { key: TF; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'public', label: '🔓 공개방' },
  { key: 'private', label: '🔑 비밀방' },
  { key: 'waiting', label: '대기 중' },
  { key: 'playing', label: '게임 중' },
];

export default function TabFilter() {
  const tabFilter = useLobbyStore((s) => s.tabFilter);
  const setTabFilter = useLobbyStore((s) => s.setTabFilter);
  const rooms = useLobbyStore((s) => s.rooms);

  const getCounts = (key: TF) => {
    switch (key) {
      case 'all': return rooms.length;
      case 'public': return rooms.filter((r) => r.roomType === 'public').length;
      case 'private': return rooms.filter((r) => r.roomType === 'private').length;
      case 'waiting': return rooms.filter((r) => r.status === 'waiting').length;
      case 'playing': return rooms.filter((r) => r.status === 'playing').length;
    }
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setTabFilter(tab.key)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            tabFilter === tab.key
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
          )}
        >
          {tab.label} ({getCounts(tab.key)})
        </button>
      ))}
    </div>
  );
}
