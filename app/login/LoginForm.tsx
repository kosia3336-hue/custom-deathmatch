'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KakaoButton } from '@/components/cdm/KakaoButton';
import { Button } from '@/components/cdm/Button';

interface Props {
  next: string;
  initialError: string | null;
}

/** 계정 서비스 오리진. 없으면 '일반 로그인' 버튼 자체를 감춘다. */
const ACCOUNT_ORIGIN = process.env.NEXT_PUBLIC_ACCOUNT_ORIGIN ?? '';

export default function LoginForm({ next, initialError }: Props) {
  const [loading, setLoading] = useState(false);
  const [generalLoading, setGeneralLoading] = useState(false);

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

  /**
   * 일반 로그인 — 계정 서비스에 로그인 여부를 묻고, 받은 토큰으로 세션을 만든다.
   *
   * 버튼 이름에 '드림샵' 을 쓰지 않는다. 커데매로 먼저 들어온 사람은 그 이름을
   * 모르기 때문이다(handover/features/sso-dreamshop.md §8).
   */
  async function handleGeneral() {
    if (!ACCOUNT_ORIGIN) return;
    setGeneralLoading(true);
    try {
      const assertRes = await fetch(`${ACCOUNT_ORIGIN}/api/sso/assert`, {
        credentials: 'include',
      });

      if (assertRes.status === 401) {
        /*
          계정 서비스에 로그인해야 한다. 홈만 띄우면 무엇을 해야 할지 알 수
          없으므로 ?login=1 로 로그인 창이 바로 열리게 한다. 계정 서비스에는
          이메일 가입이 있으므로, 계정이 없는 사람도 거기서 만들 수 있다.
        */
        const back = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
        window.location.href = `${ACCOUNT_ORIGIN}/?login=1&next=${encodeURIComponent(back)}`;
        return;
      }
      if (assertRes.status === 403) {
        const d = (await assertRes.json()) as { reason?: string };
        if (d.reason === 'terms_required') {
          /*
            계정 서비스에서 약관 동의를 아직 받지 못한 상태다.
            로그인 창을 열어 주면 그 자리에서 동의 화면이 이어진다.
            (운영 주소가 아니라 우리가 아는 오리진으로 보낸다 — 개발 환경에서
             운영으로 튀어 404 가 나던 문제가 있었다)
          */
          toast.info('계정 서비스에서 약관 동의가 필요합니다.');
          const back = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
          window.location.href = `${ACCOUNT_ORIGIN}/?login=1&next=${encodeURIComponent(back)}`;
          return;
        }
        toast.error('로그인이 거부되었습니다.');
        return;
      }
      if (!assertRes.ok) {
        toast.error('계정 서비스와 통신하지 못했습니다.');
        return;
      }

      const { token } = (await assertRes.json()) as { token?: string };
      if (!token) {
        toast.error('로그인 정보를 받지 못했습니다.');
        return;
      }

      const res = await fetch('/api/sso/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        const MESSAGES: Record<string, string> = {
          account_not_active: '이용이 제한된 계정입니다.',
          token_already_used: '로그인 정보가 만료되었습니다. 다시 시도해 주세요.',
          invalid_token: '로그인 정보가 올바르지 않습니다. 다시 시도해 주세요.',
        };
        toast.error(MESSAGES[data.error ?? ''] ?? '로그인에 실패했습니다.');
        return;
      }

      // 가입 미완료면 미들웨어가 약관 동의·닉네임 화면으로 보낸다
      window.location.href = next;
    } catch {
      toast.error('로그인 중 오류가 발생했습니다.');
    } finally {
      setGeneralLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <KakaoButton onClick={handleKakao} loading={loading} />

      {ACCOUNT_ORIGIN && (
        <>
          <Button
            variant="secondary"
            size="xl"
            fullWidth
            onClick={handleGeneral}
            loading={generalLoading}
          >
            일반 로그인
          </Button>
          <p className="text-center text-xs text-cdm-fg-muted">
            이메일·구글·디스코드·X 계정으로 로그인합니다. 계정 서비스로 이동합니다.
          </p>
        </>
      )}
    </div>
  );
}
