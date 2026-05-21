'use client';

import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Card } from '@/components/cdm/Card';

export default function EventClosedNotice() {
  const router = useRouter();
  return (
    <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 py-12 text-center">
      <h2 className="text-2xl font-bold text-cdm-fg">이벤트 게임 운영 시간이 아닙니다</h2>
      <p className="text-sm text-cdm-fg-muted">
        평일 01:00 ~ 21:00 KST / 주말 24시간 운영합니다.
        <br />운영 시간이 시작되면 다시 입장해 주세요.
      </p>
      <Button onClick={() => router.push('/')}>로비로 돌아가기</Button>
    </Card>
  );
}
