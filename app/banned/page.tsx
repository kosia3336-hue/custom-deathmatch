import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/cdm/Card';
import { Logo } from '@/components/cdm/Logo';
import { getAuthState } from '@/lib/auth/server';
import { Button } from '@/components/cdm/Button';
import InquiryOpenButton from '@/components/InquiryOpenButton';

export const metadata: Metadata = { title: '영구정지 안내' };

export default async function BannedPage() {
  const state = await getAuthState();
  if (state.kind !== 'BANNED') redirect('/');

  return (
    <main className="flex min-h-[100dvh] flex-col bg-cdm-bg">
      <header className="flex items-center justify-between border-b border-cdm-border px-4 py-3 sm:px-6">
        <Logo size="sm" />
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold text-cdm-fg">영구정지된 계정입니다</h1>
            <p className="text-sm text-cdm-fg-muted">
              이 계정은 운영 정책 위반으로 영구정지 처분을 받았습니다.
            </p>
          </div>

          <Card className="w-full" variant="highlight" accent="accent">
            <h2 className="text-xs font-semibold text-cdm-fg-muted">사유</h2>
            <p className="mt-1 text-sm text-cdm-fg">
              {state.bannedReason ?? '운영 정책 위반'}
            </p>
          </Card>

          <p className="text-xs text-cdm-fg-muted">
            이의가 있다면 문의를 보내 주세요. 답변까지는 다소 시간이 걸릴 수 있습니다.
          </p>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <InquiryOpenButton size="lg" fullWidth reasonTag="ban">
              문의하기
            </InquiryOpenButton>
            <a href="/auth/signout">
              <Button variant="secondary" size="lg" fullWidth>
                로그아웃
              </Button>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
