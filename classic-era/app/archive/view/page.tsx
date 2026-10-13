'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import GNB from '@/classic-era/components/layout/GNB';
import { useArchiveStore } from '@/classic-era/stores/archive';
import FourGravityViewer from '@/classic-era/components/archive/viewers/four-gravity/FourGravityViewer';
import Link from 'next/link';

export default function ArchiveViewPage() {
  const router = useRouter();
  const record = useArchiveStore((s) => s.record);

  useEffect(() => {
    if (!record) {
      toast.error('기록 파일을 다시 업로드해주세요.');
      router.replace('/classic/archive');
    }
  }, [record, router]);

  if (!record) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <GNB />

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <Link
          href="/classic/archive"
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← 다른 기록 열기
        </Link>

        {record.gameId === 'game-001' ? (
          <FourGravityViewer record={record} />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="mb-4 text-gray-500">이 게임의 뷰어는 아직 준비되지 않았습니다.</p>
            <pre className="mx-auto max-h-96 max-w-2xl overflow-auto rounded bg-gray-50 p-4 text-left text-xs text-gray-600">
              {JSON.stringify(record, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
