import type { Metadata } from 'next';
import Link from 'next/link';
import LoginForm from './LoginForm';
import { Logo } from '@/components/cdm/Logo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '로그인',
  description: '커스텀 데스매치에 카카오 계정으로 로그인하세요.',
};

interface PageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-cdm-bg px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <p className="text-cdm-fg-muted text-sm">정해진 룰 안에서, 정직한 한 판.</p>
        </div>

        <LoginForm next={sp.next ?? '/lobby'} initialError={sp.error ?? null} />

        <p className="text-cdm-fg-muted text-xs">
          처음 오셨나요? 가입은 카카오 로그인 후 자동 안내됩니다.
        </p>

        <nav className="flex gap-3 text-xs text-cdm-fg-muted">
          <Link href="/legal/terms" className="hover:text-cdm-fg">
            이용약관
          </Link>
          <span aria-hidden>·</span>
          <Link href="/legal/privacy" className="hover:text-cdm-fg">
            개인정보처리방침
          </Link>
        </nav>
      </div>
    </main>
  );
}
