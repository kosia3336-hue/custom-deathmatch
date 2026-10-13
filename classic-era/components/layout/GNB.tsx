'use client';

import Link from 'next/link';
import { useNicknameStore } from '@/classic-era/stores/nickname';

interface GNBProps {
  minimal?: boolean;
}

export default function GNB({ minimal }: GNBProps) {
  const nickname = useNicknameStore((s) => s.nickname);
  const openModal = useNicknameStore((s) => s.openModal);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white/80 px-4 backdrop-blur-sm md:px-6">
      <Link href="/classic" className="flex items-center gap-2">
        <span className="text-xl font-bold text-indigo-600">🎲</span>
        {!minimal && <span className="text-lg font-bold text-gray-900">더 지니어스</span>}
      </Link>

      <div className="flex items-center gap-3">
        {!minimal && (
          <Link
            href="/classic/archive"
            className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            기록실
          </Link>
        )}
        {nickname ? (
          <button
            onClick={() => openModal()}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {nickname}
          </button>
        ) : (
          <button
            onClick={() => openModal()}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            닉네임 설정
          </button>
        )}
      </div>
    </header>
  );
}
