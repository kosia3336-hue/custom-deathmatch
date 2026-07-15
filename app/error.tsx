'use client';

import Button from '@/components/ui/Button';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">일시적인 오류가 발생했습니다</h1>
      <p className="text-sm text-gray-500">잠시 후 다시 시도해 주세요.</p>
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>다시 시도</Button>
        <Button variant="secondary" onClick={() => (window.location.href = '/')}>
          홈으로
        </Button>
      </div>
    </div>
  );
}
