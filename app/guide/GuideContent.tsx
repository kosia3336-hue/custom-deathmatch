import Link from 'next/link';
import GNB from '@/components/layout/GNB';
import { getSiteUrl, jsonLdScript } from '@/lib/site';
import EmberField from './EmberField';
import GuideRulesPanel, { type GuideRuleItem } from './GuideRulesPanel';
import RuleImage from '@/components/rules/RuleImage';
import { GAME_CATEGORIES, GAME_RULES } from '@/lib/gameRules';
import { fetchAllGameRules, hasMeaningfulRule } from '@/lib/gameRulesServer';
import { MarkdownView } from '@/lib/markdown';

/**
 * 소개 페이지 본문.
 * 비로그인 방문자에게는 '/' 에서, 직접 접근 시에는 '/guide' 에서 같은 내용을 보여준다.
 */
const STEPS: Array<{ title: string; desc: string }> = [
  {
    title: '카카오로 로그인',
    desc: '별도 회원가입 없이 카카오 계정으로 3초 만에 시작합니다. 첫 로그인 시 닉네임만 정하면 됩니다.',
  },
  {
    title: '방 만들기 · 참여하기',
    desc: '로비에서 원하는 게임의 방을 새로 만들거나, 다른 사람이 만든 방에 들어가 상대를 기다립니다.',
  },
  {
    title: '1:1 대결',
    desc: '상대와 실시간으로 겨룹니다. 승패는 전적·랭킹·칭호에 반영되며, 지난 판은 게임 로그로 다시 확인할 수 있습니다.',
  },
];

/** 갈래별 색상 — 룰 목록 페이지와 동일한 계산식(빨강→보라) */
function categoryHue(category: string): number {
  const idx = GAME_CATEGORIES.indexOf(category as (typeof GAME_CATEGORIES)[number]);
  return Math.round(((idx < 0 ? 0 : idx) / GAME_CATEGORIES.length) * 300);
}

// 룰 본문은 관리자 저장 시 갱신되므로 주기적 재검증
export default async function GuideContent() {
  const siteUrl = getSiteUrl();

  /*
    룰 캐러셀은 룰 이미지(public/rules/<gameId>.webp)가 있는 종목만 싣는다.
    이미지를 새로 넣기만 하면 룰 상세 페이지와 이 섹션에 함께 나타난다(코드 수정 불필요).

    이미지에 담긴 내용은 DB(game_rule_texts)의 룰 본문과 같은 내용이므로,
    본문을 이미지의 '텍스트 대체물'로 함께 싣는다 — 눈으로는 이미지를 보고,
    스크린리더와 검색엔진은 글을 읽는다.
  */
  const allRules = await fetchAllGameRules();
  const ruleItems: GuideRuleItem[] = GAME_RULES.filter((g) => allRules[g.id]?.imageUrl).map((g) => {
    const { rules, meta } = allRules[g.id] ?? { rules: '', meta: undefined };
    const hasMeta = Boolean(
      meta && (meta.source || meta.originUrl || meta.originalAuthor || meta.poster),
    );

    return {
      id: g.id,
      name: g.name,
      category: g.category,
      hue: categoryHue(g.category),
      node: (
        <>
          <RuleImage src={allRules[g.id]!.imageUrl} name={g.name} />
          {hasMeaningfulRule(rules) && (
            <div className="sr-only">
              <MarkdownView source={rules} />
              {hasMeta && (
                <div>
                  {meta!.source && <p>출처: {meta!.source}</p>}
                  {meta!.originalAuthor && <p>원작자: {meta!.originalAuthor}</p>}
                  {meta!.poster && <p>게시자: {meta!.poster}</p>}
                  {meta!.originUrl && <p>원본 룰: {meta!.originUrl}</p>}
                </div>
              )}
            </div>
          )}
        </>
      ),
    };
  });

  const base = siteUrl.replace(/\/$/, '');

  /*
    브랜드 검색 대응 — 검색엔진이 '커스텀 데스매치'를 하나의 개체(entity)로 인식하도록
    WebSite / Organization 을 명시한다. alternateName 으로 영문 표기도 함께 연결한다.
    (meta keywords 는 검색엔진이 무시하므로 여기에 쌓는 것이 실제로 의미가 있다.)
  */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: '커스텀 데스매치',
        alternateName: ['Custom Deathmatch', 'customdeathmatch'],
        description:
          '설치 없이 브라우저에서 즐기는 1:1 심리·전략 게임 플랫폼.',
        inLanguage: 'ko-KR',
        publisher: { '@id': `${base}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${base}/#organization`,
        name: '커스텀 데스매치',
        alternateName: 'Custom Deathmatch',
        url: `${base}/`,
        logo: `${base}/opengraph-image`,
      },
      {
        '@type': 'HowTo',
        name: '커스텀 데스매치 시작 가이드',
        description:
          '카카오 로그인 후 로비에서 방을 만들거나 참여해 1:1 심리·전략 게임을 즐기는 방법.',
        inLanguage: 'ko-KR',
        step: STEPS.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.title,
          text: s.desc,
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-cdm-ink">
      <GNB />

      <main className="flex-1">
        {/* 히어로 — 그라데이션 + 잿불 */}
        <section className="guide-hero px-4 py-20 text-center md:py-28">
          <EmberField />

          <div className="relative z-10 mx-auto w-full max-w-3xl">
            <p className="text-xs font-bold tracking-[0.4em] text-cdm-ink-fg-muted md:text-sm">
              CUSTOM DEATHMATCH
            </p>
            {/* h1 에 브랜드명을 함께 둔다 — 브랜드 검색에서 본문 근거가 되도록 */}
            <h1 className="mt-5">
              <span className="block text-lg font-bold text-cdm-ink-fg md:text-xl">
                커스텀 데스매치
              </span>
              <span className="guide-title mt-2 block text-4xl leading-[1.15] font-black tracking-tight md:text-6xl">
                한 수에 모든 것이
                <br />
                갈립니다
              </span>
            </h1>
            <div className="guide-rule-line mx-auto mt-7 w-40" />
            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-cdm-ink-fg-muted md:text-lg">
              커스텀 데스매치는 설치도, 준비도 필요 없습니다. 흑과백·인디언 홀덤·베팅 가위바위보까지{' '}
              <span className="block sm:inline">심리와 전략만으로 겨루는 1:1 두뇌 대결의 장입니다.</span>
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="guide-cta w-full rounded-xl px-8 py-3.5 text-center font-bold text-white transition sm:w-auto"
              >
                카카오로 시작하기
              </Link>
              <Link
                href="/rules"
                className="w-full rounded-xl border border-white/15 px-8 py-3.5 text-center font-semibold text-cdm-ink-fg transition hover:border-white/35 hover:bg-white/5 sm:w-auto"
              >
                전체 게임 룰 보기
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 md:py-20">
          {/* 3단계 */}
          <section>
            <h2 className="text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              시작까지 세 단계
            </h2>
            <p className="mt-2 text-sm text-cdm-ink-fg-muted">
              가입 절차는 최소한으로 줄였습니다.
            </p>

            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="guide-card rounded-2xl p-6">
                  <div className="text-3xl font-black text-white/15">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-cdm-ink-fg">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cdm-ink-fg-muted">
                    {step.desc}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* 게임 목록 — 어두운 무대 위의 밝은 룰 판 */}
          <section className="mt-20">
            <h2 className="text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              다양한 게임들과 규칙을 확인해 보세요.
            </h2>

            <div className="mt-6">
              <GuideRulesPanel items={ruleItems} />
            </div>
          </section>

          {/* 하단 CTA */}
          <section className="guide-card mt-20 rounded-2xl px-8 py-12 text-center">
            <h2 className="text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              상대는 이미 기다리고 있습니다
            </h2>
            <p className="mt-3 text-sm text-cdm-ink-fg-muted">
              카카오 로그인 한 번이면 곧바로 로비에 입장합니다.
            </p>
            <Link
              href="/login"
              className="guide-cta mt-8 inline-block rounded-xl px-9 py-3.5 font-bold text-white transition"
            >
              카카오로 시작하기
            </Link>
          </section>
        </div>
      </main>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
    </div>
  );
}
