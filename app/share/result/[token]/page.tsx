import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ResultShareCard from '@/components/share/ResultShareCard';
import { loadResultShare } from '@/lib/share/loadResultShare';
import { describeResultShare } from '@/lib/share/resultShareView';

interface Props {
  params: Promise<{ token: string }>;
}

// 토큰마다 DB 에서 읽는다. 공유 링크는 검색 결과에 올리지 않는다.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const view = await loadResultShare(token);
  const robots = { index: false, follow: false };
  if (!view) return { title: '전적 공유', robots };

  const title = `${view.sharerNickname}님의 ${view.gameName} ${view.resultLabel}`;
  const description = describeResultShare(view);
  return {
    title,
    description,
    robots,
    // 카드 이미지는 같은 폴더의 opengraph-image.tsx 가 결과 내용으로 그린다
    openGraph: {
      title: `${title} | 커스텀 데스매치`,
      description,
      type: 'website',
      url: `/share/result/${token}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | 커스텀 데스매치`,
      description,
    },
  };
}

export default async function ResultSharePage({ params }: Props) {
  const { token } = await params;
  const view = await loadResultShare(token);
  if (!view) notFound();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <ResultShareCard view={view} />
    </div>
  );
}
