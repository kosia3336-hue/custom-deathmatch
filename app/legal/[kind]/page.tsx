import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/cdm/Logo';
import { Card } from '@/components/cdm/Card';
import { getServerSupabase } from '@/lib/supabase/server';

const KIND_LABEL: Record<string, string> = {
  terms: '서비스 이용약관',
  privacy: '개인정보 처리방침',
  marketing: '마케팅 정보 수신 동의',
};

interface Props {
  params: Promise<{ kind: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  if (!(kind in KIND_LABEL)) return { title: '약관' };
  return {
    title: KIND_LABEL[kind],
    alternates: { canonical: `/legal/${kind}` },
  };
}

export default async function LegalPage({ params }: Props) {
  const { kind } = await params;
  if (!(kind in KIND_LABEL)) notFound();

  const supabase = await getServerSupabase();
  const res = await supabase
    .from('agreement_versions')
    .select('body, version, published_at')
    .eq('kind', kind as 'terms' | 'privacy' | 'marketing')
    .eq('is_active', true)
    .maybeSingle();
  const data = res.data as unknown as
    | { body: string; version: number; published_at: string }
    | null;

  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-cdm-bg px-6 py-8 sm:py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <Logo size="sm" />
          <h1 className="text-xl font-bold text-cdm-fg sm:text-2xl">{KIND_LABEL[kind]}</h1>
          {data && (
            <p className="text-xs text-cdm-fg-muted">
              버전 v{data.version} · {new Date(data.published_at).toLocaleDateString('ko-KR')}
            </p>
          )}
        </header>

        <Card>
          {data ? (
            <article className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-cdm-fg">
              {data.body}
            </article>
          ) : (
            <p className="text-sm text-cdm-fg-muted">현재 게시된 약관이 없습니다.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
