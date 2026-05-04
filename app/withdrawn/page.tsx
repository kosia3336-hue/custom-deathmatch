import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/cdm/Logo';
import { getAuthState } from '@/lib/auth/server';
import { Button } from '@/components/cdm/Button';
import InquiryOpenButton from '@/components/InquiryOpenButton';

export const metadata: Metadata = { title: '탈퇴한 계정' };

export default async function WithdrawnPage() {
  const state = await getAuthState();
  if (state.kind !== 'WITHDRAWN') redirect('/');

  return (
    <main className="flex min-h-[100dvh] flex-col bg-cdm-bg">
      <header className="flex items-center justify-between border-b border-cdm-border px-4 py-3 sm:px-6">
        <Logo size="sm" />
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-4xl" aria-hidden>
              👤
            </span>
            <h1 className="text-2xl font-bold text-cdm-fg">탈퇴한 계정입니다</h1>
            <p className="text-sm text-cdm-fg-muted">
              이 계정은 탈퇴 처리되어 더 이상 이용할 수 없습니다.
            </p>
          </div>

          <p className="text-xs text-cdm-fg-muted text-center">
            복구를 원하신다면 아래 버튼으로 문의해 주세요. 관리자 검토 후 복구 여부를 안내해
            드립니다.
          </p>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <InquiryOpenButton size="lg" fullWidth reasonTag="withdrawal">
              복구 문의하기
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
