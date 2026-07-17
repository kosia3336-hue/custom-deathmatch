'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { useCurrentMember } from '@/hooks/useCurrentMember';

/** 로비 — 이벤트 쿠폰함 이동 버튼 (랭크 게임 옆, 이전 '이벤트 게임' 버튼 자리) */
export default function EventCouponLobbyButton() {
  const router = useRouter();
  const { member } = useCurrentMember();

  const handleClick = () => {
    if (!member) {
      toast.error('이벤트 쿠폰함은 로그인 후 이용할 수 있습니다.');
      return;
    }
    router.push('/event');
  };

  return (
    <Button type="button" variant="secondary" onClick={handleClick}>
      <span className="hidden sm:inline">이벤트 쿠폰함</span>
      <span className="sm:hidden">쿠폰함</span>
    </Button>
  );
}
