'use client';

import { useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { shareOrCopy } from '@/lib/share';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

interface Props {
  roomId: string;
}

export default function InviteButton({ roomId }: Props) {
  const handleInvite = useCallback(() => {
    const socket = getSocket();
    socket.emit('room:invite:create', (res) => {
      if (res.success && res.token) {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
        const link = `${baseUrl}/room/${roomId}?invite=${res.token}`;

        void shareOrCopy({ title: '커스텀 데스매치 초대', url: link }).then((outcome) => {
          if (outcome === 'copied') toast.success('초대 링크가 복사되었습니다!');
          else if (outcome === 'failed') toast.error('링크 복사에 실패했습니다.');
        });
      }
    });
  }, [roomId]);

  return (
    <Button variant="secondary" onClick={handleInvite}>
      초대 링크 공유
    </Button>
  );
}
