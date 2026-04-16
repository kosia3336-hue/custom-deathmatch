'use client';

import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useSessionTakeoverStore } from '@/stores/sessionTakeover';
import { getSocket, getOrCreateSessionToken } from '@/lib/socket';

export default function SessionTakeoverModal() {
  const router = useRouter();
  const pending = useSessionTakeoverStore((s) => s.pending);
  const clearPending = useSessionTakeoverStore((s) => s.clearPending);

  const handleConfirm = () => {
    const token = getOrCreateSessionToken();
    clearPending();
    // 네비게이션은 useSocket.ts의 onSessionRestored에서 처리
    getSocket().emit('session:restore', { token, confirmed: true });
  };

  const handleCancel = () => {
    clearPending();
    getSocket().disconnect();
    router.replace('/disconnected');
  };

  return (
    <Modal
      open={!!pending}
      closable={false}
      title="이어서 접속"
    >
      <p className="mb-1 text-sm text-gray-700">
        <span className="font-semibold">{pending?.nickname}</span> 으로 접속 중인 세션이 있습니다.
      </p>
      <p className="mb-4 text-xs text-gray-500">
        {pending?.roomId ? '진행 중인 게임방으로 이동합니다.' : '기존 연결이 끊어집니다.'}
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={handleCancel}>취소</Button>
        <Button onClick={handleConfirm}>이어서 접속</Button>
      </div>
    </Modal>
  );
}
