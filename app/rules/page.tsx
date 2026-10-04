import type { Metadata } from 'next';
import Link from 'next/link';
import GNB from '@/components/layout/GNB';
import { getActiveMember } from '@/lib/auth/server';
import RulesClient from './RulesClient';
import { CONTAINER_READ } from '@/lib/layout';
import { GAME_CATEGORIES, GAME_RULES } from '@/lib/gameRules';
import { fetchAllGameRules, hasMeaningfulRule } from '@/lib/gameRulesServer';
import { extractPlainText } from '@/lib/markdown';
import { isUnreleasedGame } from '@/lib/unreleasedGames';

const DESCRIPTION =
  '커스텀 데스매치의 게임 룰 모음. 심리·추상전략·수리·언어·관찰 다섯 갈래의 게임 규칙을 한곳에서 확인하세요.';

/*
  게임 룰 목록. 검색에서 룰 페이지로 들어가는 허브다.

  예전에는 게임 이름만 나열돼 검색엔진이 읽을 글이 300자 남짓이었고,
  Search Console 에서 '크롤링됨 - 현재 색인이 생성되지 않음' 으로 남았다(2026-10).
  그래서 아래에 게임마다 룰 본문 앞부분을 서버에서 그려 붙인다. 위쪽 벽돌 목록은
  화면용 그대로 둔다.
*/
export const metadata: Metadata = {
  title: '게임 룰',
  description: DESCRIPTION,
  alternates: { canonical: '/rules' },
  openGraph: {
    title: '게임 룰 | 커스텀 데스매치',
    description: DESCRIPTION,
    url: '/rules',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Custom Deathmatch',
  },
};

export default async function RulesPage() {
  /* 출시 전 게임은 관리자에게만 보인다 (lib/unreleasedGames.ts) */
  const member = await getActiveMember();
  const isAdmin = member?.role === 'admin';

  const contents = await fetchAllGameRules();
  const visible = GAME_RULES.filter(
    (g) => !g.hiddenInLadder && (isAdmin || !isUnreleasedGame(g.id)),
  );

  return (
    <div className="flex flex-1 flex-col bg-cdm-page">
      <GNB />
      <main className={`${CONTAINER_READ} flex-1 p-4 md:p-6`}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">게임 룰</h1>
          <p className="mt-1 text-sm text-cdm-fg-muted">
            게임을 눌러 룰을 확인하세요.
          </p>
        </div>
        <RulesClient isAdmin={isAdmin} />

        {/* 게임별 요약 — 룰 본문 앞부분을 서버에서 그린다(검색엔진이 읽는 글) */}
        <section className="mt-12" aria-labelledby="rules-summary">
          <h2 id="rules-summary" className="text-lg font-bold text-cdm-fg">
            게임별 요약
          </h2>
          <p className="mt-1 text-sm text-cdm-fg-muted">
            커스텀 데스매치의 게임은 심리·추상전략·수리·언어·관찰 다섯 갈래로 나뉩니다. 게임 이름을 누르면
            전체 룰을 볼 수 있습니다.
          </p>
          {GAME_CATEGORIES.map((cat) => {
            const games = visible.filter((g) => g.category === cat);
            if (games.length === 0) return null;
            return (
              <div key={cat} className="mt-6">
                <h3 className="text-sm font-extrabold text-cdm-fg">{cat}</h3>
                <dl className="mt-2 divide-y divide-cdm-border">
                  {games.map((g) => {
                    const body = contents[g.id]?.rules?.trim() ?? '';
                    const summary = hasMeaningfulRule(body)
                      ? extractPlainText(body, 140)
                      : `${g.name} — 커스텀 데스매치에서 즐기는 ${g.category} 게임입니다.`;
                    return (
                      <div key={g.id} className="py-3">
                        <dt>
                          <Link href={`/rules/${g.id}`} className="font-bold text-cdm-fg underline-offset-2 hover:underline">
                            {g.name}
                          </Link>
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-cdm-fg-muted">{summary}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
