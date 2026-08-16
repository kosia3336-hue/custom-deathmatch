import Link from 'next/link';
import GNB from '@/components/layout/GNB';
import { getSiteUrl, jsonLdScript } from '@/lib/site';
import EmberField from './EmberField';
import IntroRulesPanel, { type IntroRuleItem } from './IntroRulesPanel';
import RuleSheet from '@/components/rules/RuleSheet';
import { GAME_RULES, categoryHue } from '@/lib/gameRules';
import { fetchAllGameRules, hasMeaningfulRule } from '@/lib/gameRulesServer';

/**
 * 소개 페이지 본문 — 사이트의 대표 페이지('/')다.
 * 로비는 /lobby 에 따로 있고, 옛 주소 /guide 는 여기로 영구 이동시킨다.
 */
const STEPS: Array<{ title: string; desc: string }> = [
  {
    title: '카카오로 로그인',
    desc: '따로 가입할 것은 없습니다. 카카오 계정으로 들어와 닉네임만 정하면 끝입니다.',
  },
  {
    title: '방 만들기 · 참여하기',
    desc: '로비에서 하고 싶은 종목으로 방을 열거나, 이미 열려 있는 방에 들어가면 됩니다.',
  },
  {
    title: '1:1 대결',
    desc: '승패는 전적과 랭킹, 칭호에 그대로 쌓입니다. 지난 판은 게임 로그에서 다시 볼 수 있습니다.',
  },
];

// 룰 본문은 관리자 저장 시 갱신되므로 주기적 재검증
export default async function IntroContent() {
  const siteUrl = getSiteUrl();

  /*
    룰이 등록된 종목을 룰지(RuleSheet)로 싣는다 — 배경 위에 본문을 진짜 텍스트로
    얹으므로 좁은 화면에서도 읽히고, 검색엔진도 그대로 수집한다.
    관리자가 룰을 저장하면 저장 API 가 이 경로를 재검증해 바로 반영된다.
  */
  const allRules = await fetchAllGameRules();
  const ruleItems: IntroRuleItem[] = GAME_RULES.filter((g) =>
    hasMeaningfulRule(allRules[g.id]?.rules),
  ).map((g) => {
    const rules = allRules[g.id]?.rules ?? '';

    return {
      id: g.id,
      name: g.name,
      category: g.category,
      hue: categoryHue(g.category),
      node: (
        <RuleSheet
          name={g.name}
          category={g.category}
          source={rules}
          imageUrl={allRules[g.id]?.imageUrl || undefined}
        />
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
          '설치 없이 브라우저에서 즐기는 1:1 심리·전략 게임 플랫폼. 지니어스·데블스 플랜·피의 게임에서 보던 두뇌 서바이벌 종목을 다룬다.',
        keywords: [
          '두뇌 서바이벌', '심리 게임', '전략 게임', '1:1 두뇌 게임',
          '지니어스', '더 지니어스', '데블스 플랜', '피의 게임',
          '흑과백', '인디언 홀덤', '베팅 가위바위보', '연승게임', '해달별',
        ],
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
              내려받을 것도, 준비물도 없습니다. 흑과백·인디언 홀덤·베팅 가위바위보까지{' '}
              <span className="block sm:inline">오직 심리와 수읽기로 겨루는 1:1 게임입니다.</span>
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="guide-cta w-full rounded-xl px-8 py-3.5 text-center font-bold text-white transition sm:w-auto"
              >
                카카오로 시작하기
              </Link>
              {/* 별도 페이지로 보내지 않고 같은 화면 아래 룰 영역으로 내린다 */}
              <a
                href="#rules"
                className="w-full rounded-xl border border-white/15 px-8 py-3.5 text-center font-semibold text-cdm-ink-fg transition hover:border-white/35 hover:bg-white/5 sm:w-auto"
              >
                게임 룰 보기
              </a>
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
              여기까지 오래 걸리지 않습니다.
            </p>

            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="guide-card rounded-2xl p-6">
                  <div className="guide-step-num text-3xl font-black">
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
          <section id="rules" className="mt-20 scroll-mt-24">
            <h2 className="text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              어떤 게임이 있나
            </h2>
            <p className="mt-2 text-sm text-cdm-ink-fg-muted">
              지니어스·데블스 플랜·피의 게임에서 보던 두뇌 서바이벌 종목들입니다.
              종목을 누르면 규칙이 바로 펼쳐집니다.
            </p>

            <div className="mt-6">
              <IntroRulesPanel items={ruleItems} />
            </div>
          </section>

          {/* 하단 CTA */}
          <section className="guide-card mt-20 rounded-2xl px-8 py-12 text-center">
            <h2 className="text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              상대는 이미 기다리고 있습니다
            </h2>
            <p className="mt-3 text-sm text-cdm-ink-fg-muted">
              로그인 전에 로비부터 둘러봐도 됩니다.
            </p>
            <Link
              href="/lobby"
              className="guide-cta mt-8 inline-block rounded-xl px-9 py-3.5 font-bold text-white transition"
            >
              로비 둘러보기
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
