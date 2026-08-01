import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/cdm/Logo';
import ProfileForm from './ProfileForm';
import { getServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = { title: '닉네임 설정' };

export default async function ProfilePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-cdm-bg px-6 py-8 sm:py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <h1 className="text-xl font-bold text-cdm-fg sm:text-2xl">
            닉네임을 설정해 주세요
          </h1>
          <p className="text-sm text-cdm-fg-muted">
            2~8자 한글/영문/숫자. 가입 후 30일에 1회 변경할 수 있습니다.
          </p>
        </header>

        <ProfileForm />
      </div>
    </main>
  );
}
