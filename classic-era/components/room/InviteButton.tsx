'use client';

import { useCallback } from 'react';
import { getSocket } from '@/classic-era/lib/socket';
import Button from '@/classic-era/components/ui/Button';
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
        const link = `${baseUrl}/classic/room/${roomId}?invite=${res.token}`;

        if (navigator.share) {
          navigator.share({ title: '더 지니어스 초대', url: link }).catch(() => {});
        } else {
          navigator.clipboard.writeText(link).then(() => {
            toast.success('초대 링크가 복사되었습니다!');
          }).catch(() => {
            toast.error('링크 복사에 실패했습니다.');
          });
        }
      }
    });
  }, [roomId]);

  return (
    <Button variant="secondary" onClick={handleInvite}>
      초대 링크 복사
    </Button>
  );
}
