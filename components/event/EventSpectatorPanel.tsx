'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { getSocket } from '@/lib/socket';
import type { IPEStatePayload } from '@/shared/types';

interface Props {
  state: IPEStatePayload;
}

export default function EventSpectatorPanel({ state }: Props) {
  const router = useRouter();

  const handleLeave = () => {
    getSocket().emit('event:leave');
    router.push('/lobby');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-cdm-md border border-cdm-border bg-cdm-bg p-3 sm:p-4">
      <div className="flex flex-col gap-1 text-sm">
        {state.role === 'queued' ? (
          <>
            <div className="font-bold text-cdm-fg">
              대기열 {state.myQueuePosition ?? '-'}번
            </div>
            <div className="text-xs text-cdm-fg-muted">
              자리가 나면 자동으로 입장합니다. (총 대기 {state.queueLength}명)
            </div>
          </>
        ) : (
          <>
            <div className="font-bold text-cdm-fg">관전 중</div>
            <div className="text-xs text-cdm-fg-muted">
              칩이 부족해 좌석에 앉지 못합니다. 상점에서 이벤트 칩을 구매하면 자동 대기열에 등록됩니다.
            </div>
          </>
        )}
        <div className="text-xs text-cdm-fg-muted">
          내 보유 칩: <strong className="text-cdm-fg tabular-nums">{state.myChipBalance}</strong>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            router.push('/shop?type=event_chip_pack');
            toast('상점에서 이벤트 칩을 구매해보세요.');
          }}
        >
          상점에서 칩 구매
        </Button>
        <Button variant="ghost" onClick={handleLeave}>
          퇴장
        </Button>
      </div>
    </div>
  );
}
