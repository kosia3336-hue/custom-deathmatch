'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KakaoButton } from '@/components/cdm/KakaoButton';

interface Props {
  next: string;
  initialError: string | null;
}

export default function LoginForm({ next, initialError }: Props) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialError) {
      toast.error(decodeURIComponent(initialError));
    }
  }, [initialError]);

  function handleKakao() {
    setLoading(true);
    // Supabase 내장 카카오 프로바이더 대신 커스텀 OAuth 라우트로 이동
    window.location.href = `/auth/kakao?next=${encodeURIComponent(next)}`;
  }

  return (
    <div className="w-full">
      <KakaoButton onClick={handleKakao} loading={loading} />
    </div>
  );
}
