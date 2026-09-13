import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/cdm/Button';
import { GNB } from '@/components/cdm/GNB';
import GameLogView from '@/components/game/GameLogView';
import { getActiveMember } from '@/lib/auth/server';
import { loadResultShare } from '@/lib/share/loadResultShare';
import { describeResultShare } from '@/lib/share/resultShareView';

interface Props {
  params: Promise<{ token: string }>;
}

// 토큰마다 DB 에서 읽는다. 공유 링크는 검색 결과에 올리지 않는다.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await loadResultShare(token);
  const robots = { index: false, follow: false };
  if (!data) return { title: '전적 공유', robots };

  const { view } = data;
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

/**
 * 결과 공유 링크를 누르면 여는 공개 기보 페이지.
 * 참가자 로그 화면과 같은 기록이며, 로그인 없이 누구나 같은 화면을 본다
 * (익명 물약 상대는 항상 ???, lib/share/publicLogProps.ts).
 */
export default async function ResultSharePage({ params }: Props) {
  const { token } = await params;
  const [data, member] = await Promise.all([loadResultShare(token), getActiveMember()]);
  if (!data) notFound();
  const { view, log } = data;

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 px-4 py-3">
          <p className="min-w-0 text-sm text-cdm-fg">
            <span className="font-semibold">{view.sharerNickname}</span>님이 공유한 {view.gameName} 기록
          </p>
          <div className="flex shrink-0 gap-2">
            <Link href={`/rules/${view.gameId}`}>
              <Button variant="ghost" size="sm">
                룰 보기
              </Button>
            </Link>
            <Link href="/lobby">
              <Button size="sm">나도 한 판 하기</Button>
            </Link>
          </div>
        </div>

        <GameLogView players={log.players} meta={log.meta} record={log.record} viewingAs="admin" />
      </main>
    </>
  );
}
