import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/cdm/Logo';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { getServerSupabase } from '@/lib/supabase/server';
import InquiryForm from './InquiryForm';

export const metadata: Metadata = { title: '문의' };

interface Props {
  searchParams: Promise<{ reason?: string }>;
}

export default async function InquiryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const reason = sp.reason;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/support/inquiry');

  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-cdm-bg px-6 py-8 sm:py-12">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <h1 className="text-xl font-bold text-cdm-fg sm:text-2xl">문의 보내기</h1>
          <p className="text-sm text-cdm-fg-muted">
            {reason === 'suspension' && '활동 정지 이의가 있다면 자세한 상황을 알려주세요.'}
            {reason === 'ban' && '영구정지에 대해 이의가 있다면 자세한 상황을 알려주세요.'}
            {!reason && '서비스 이용 중 문의 사항을 보내주세요. 최대한 빠른 시일 내로 답변드립니다.'}
          </p>
        </header>

        <Card>
          <InquiryForm reasonTag={reason ?? null} />
        </Card>

        <div className="flex justify-center">
          <a href="/auth/signout">
            <Button variant="ghost" size="sm">
              로그아웃
            </Button>
          </a>
        </div>
      </div>
    </main>
  );
}
