import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { Logo } from '@/components/cdm/Logo';
import { getAuthState } from '@/lib/auth/server';
import SuspendedCountdown from './SuspendedCountdown';
import InquiryOpenButton from '@/components/InquiryOpenButton';

export const metadata: Metadata = { title: '활동 정지' };

export default async function SuspendedPage() {
  const state = await getAuthState();
  if (state.kind !== 'SUSPENDED') redirect('/lobby');

  return (
    <main className="flex min-h-[100dvh] flex-col bg-cdm-bg">
      <header className="flex items-center justify-between border-b border-cdm-border px-4 py-3 sm:px-6">
        <Logo size="sm" />
        <span className="text-sm text-cdm-fg-muted">{state.member.nickname}</span>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-4xl" aria-hidden>
              ⏸
            </span>
            <h1 className="text-2xl font-bold text-cdm-fg">활동이 정지되었습니다</h1>
            <p className="text-sm text-cdm-fg-muted">
              이 계정은 현재 활동이 정지되어 있습니다. 정지 기간 동안에는 게임 참여 / 방 만들기 /
              채팅 / 신고 작성 등 대부분의 기능을 이용할 수 없습니다.
            </p>
          </div>

          <Card className="w-full" variant="highlight" accent="highlight">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xs font-semibold text-cdm-fg-muted">사유</h2>
                <p className="mt-1 text-sm text-cdm-fg">
                  {state.suspendedReason ?? '운영 정책 위반'}
                </p>
              </div>
              {state.suspendedUntil && (
                <div>
                  <h2 className="text-xs font-semibold text-cdm-fg-muted">종료 일시</h2>
                  <p className="mt-1 text-sm text-cdm-fg">
                    {new Date(state.suspendedUntil).toLocaleString('ko-KR', {
                      timeZone: 'Asia/Seoul',
                    })}
                  </p>
                  <SuspendedCountdown until={state.suspendedUntil} />
                </div>
              )}
            </div>
          </Card>

          <p className="text-xs text-cdm-fg-muted">
            해제 후 다시 이용해 주세요. 이의가 있다면 문의를 보내 주세요.
          </p>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="w-full sm:w-auto">
              <InquiryOpenButton size="lg" fullWidth reasonTag="suspension">
                문의하기
              </InquiryOpenButton>
            </div>
            <a href="/auth/signout" className="w-full sm:w-auto">
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
