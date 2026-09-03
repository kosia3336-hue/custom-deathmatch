import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import AgreementForm, { type AgreementVersion } from './AgreementForm';
import { Logo } from '@/components/cdm/Logo';
import { getServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: '약관 동의',
};

export default async function AgreementPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  /*
    카카오 가입자에게만 마케팅 수신 동의를 보여준다.
    발송 수단이 카카오 채널뿐이라 다른 경로로 들어온 사람에게는 받아 둘
    곳이 없다. 계정 서비스(일반 로그인)로 들어온 계정은 provider 가 다르다.
  */
  const isKakao = (user.user_metadata as { provider?: string } | undefined)?.provider === 'kakao';

  const { data, error } = await supabase
    .from('agreement_versions')
    .select('id, kind, version, body, published_at')
    .eq('is_active', true)
    .order('kind');

  type Row = { id: number; kind: 'terms' | 'privacy' | 'marketing'; version: number; body: string };
  const list: AgreementVersion[] =
    !error && data
      ? (data as unknown as Row[]).map((r) => ({
          id: r.id,
          kind: r.kind,
          version: r.version,
          body: r.body,
        }))
      : [];

  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-cdm-bg px-6 py-8 sm:py-12">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <h1 className="text-xl font-bold text-cdm-fg sm:text-2xl">
            커스텀 데스매치에 오신 것을 환영합니다
          </h1>
          <p className="text-sm text-cdm-fg-muted">계속하려면 아래 약관에 동의해 주세요.</p>
        </header>

        <AgreementForm versions={list} showMarketing={isKakao} />
      </div>
    </main>
  );
}
