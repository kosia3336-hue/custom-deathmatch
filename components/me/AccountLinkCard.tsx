'use client';

/**
 * 일반 로그인 계정 연동.
 *
 * 두 서비스는 Supabase 프로젝트가 달라 세션을 공유할 수 없다. 대신 계정 서비스가
 * "이 브라우저가 그 계정으로 로그인해 있다" 를 60초짜리 서명 토큰으로 증명해 주고,
 * 이 화면이 그 토큰을 서버(/api/link)로 넘겨 짝을 만든다.
 *
 * 두 세션을 모두 가진 사람만 연동할 수 있다 — 그것이 소유 증명이다.
 *
 * 사용자에게는 '드림샵' 이라는 이름을 쓰지 않는다. 커데매로 먼저 들어온 사람은
 * 그 이름을 모르기 때문이다(handover/features/sso-dreamshop.md §8).
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';

/** 계정 서비스 오리진. 빌드 시점에 박히므로 NEXT_PUBLIC_ 이어야 한다. */
const ACCOUNT_ORIGIN = process.env.NEXT_PUBLIC_ACCOUNT_ORIGIN ?? '';

interface LinkState {
  linked: boolean;
  link: { linked_via: string; linked_at: string } | null;
}

export function AccountLinkCard() {
  const [state, setState] = useState<LinkState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/link');
      if (!res.ok) {
        setState({ linked: false, link: null });
        return;
      }
      setState((await res.json()) as LinkState);
    } catch {
      setState({ linked: false, link: null });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const link = async () => {
    if (!ACCOUNT_ORIGIN) {
      toast.error('계정 서비스 주소가 설정되지 않았습니다.');
      return;
    }
    setBusy(true);
    try {
      /*
        같은 site(choen.kr) 라서 credentials 를 포함하면 계정 서비스 쿠키가 실린다.
        로그인해 있지 않으면 401, 약관 미동의면 403 이 온다.
      */
      const assertRes = await fetch(`${ACCOUNT_ORIGIN}/api/sso/assert`, {
        credentials: 'include',
      });

      if (assertRes.status === 401) {
        const d = (await assertRes.json()) as { loginUrl?: string };
        toast.info('계정 서비스에 먼저 로그인해 주세요.');
        window.location.href = d.loginUrl || ACCOUNT_ORIGIN;
        return;
      }
      if (assertRes.status === 403) {
        const d = (await assertRes.json()) as { agreeUrl?: string; reason?: string };
        if (d.reason === 'cdm_terms_required' && d.agreeUrl) {
          toast.info('연동하려면 커스텀 데스매치 약관 동의가 필요합니다.');
          window.location.href = d.agreeUrl;
          return;
        }
        toast.error('연동이 거부되었습니다.');
        return;
      }
      if (!assertRes.ok) {
        toast.error('계정 서비스와 통신하지 못했습니다.');
        return;
      }

      const { token } = (await assertRes.json()) as { token?: string };
      if (!token) {
        toast.error('연동 정보를 받지 못했습니다.');
        return;
      }

      const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        const MESSAGES: Record<string, string> = {
          already_linked: '이미 다른 계정과 연동되어 있습니다.',
          dreamshop_account_taken: '그 계정은 다른 회원과 연동되어 있습니다.',
          token_already_used: '연동 정보가 만료되었습니다. 다시 시도해 주세요.',
          invalid_token: '연동 정보가 올바르지 않습니다. 다시 시도해 주세요.',
        };
        toast.error(MESSAGES[data.error ?? ''] ?? '연동에 실패했습니다.');
        return;
      }

      toast.success('계정을 연동했습니다.');
      await load();
    } catch {
      toast.error('연동 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/link', { method: 'DELETE' });
      if (!res.ok) {
        toast.error('연동 해제에 실패했습니다.');
        return;
      }
      toast.success('연동을 해제했습니다.');
      await load();
    } catch {
      toast.error('연동 해제 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // 계정 서비스 주소가 없으면(연동 미설정 환경) 카드 자체를 감춘다
  if (!ACCOUNT_ORIGIN) return null;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-cdm-fg-muted">일반 로그인 계정 연동</h2>

      {state === null ? (
        <p className="mt-3 text-sm text-cdm-fg-muted">확인 중…</p>
      ) : state.linked ? (
        <>
          <p className="mt-3 text-sm text-cdm-fg">
            연동되어 있습니다.
            {state.link?.linked_via === 'kakao_id' && ' (같은 카카오 계정으로 확인됨)'}
          </p>
          <p className="mt-1 text-xs text-cdm-fg-muted">
            연동을 해제하면 일반 로그인으로는 이 계정에 들어올 수 없습니다.
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={unlink} disabled={busy}>
              연동 해제
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-cdm-fg-muted">
            연동하면 이메일·구글·디스코드·X 계정으로도 이 계정에 로그인할 수 있습니다.
          </p>
          <p className="mt-1 text-xs text-cdm-fg-muted">
            누르면 계정 서비스로 이동해 로그인 여부를 확인합니다.
          </p>
          <div className="mt-3">
            <Button onClick={link} disabled={busy}>
              {busy ? '연동 중…' : '계정 연동하기'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
