import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GNB from '@/components/layout/GNB';
import { Card } from '@/components/cdm/Card';
import { BackButton } from '@/components/cdm/BackButton';
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
    <div className="flex min-h-[100dvh] flex-col bg-cdm-page">
      <GNB />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <BackButton />
        </div>
        <header className="flex flex-col items-center gap-2 text-center">
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
      </main>
    </div>
  );
}
