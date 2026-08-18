import Image from 'next/image';
import Link from 'next/link';
import AboutGNB from './AboutGNB';
import { getSiteUrl, jsonLdScript } from '@/lib/site';
import EmberField from './EmberField';
import IntroRankPanel from './IntroRankPanel';
import IntroTitlesPanel, { type IntroTitleModalData } from './IntroTitlesPanel';
import IntroRulesPanel, { type IntroRuleItem } from './IntroRulesPanel';
import RuleSheet from '@/components/rules/RuleSheet';
import { GAME_RULES, categoryHue } from '@/lib/gameRules';
import { fetchAllGameRules, hasMeaningfulRule } from '@/lib/gameRulesServer';

/**
 * 소개 페이지 본문 — 검색·신규 유입의 대표 문서(/about)다.
 * 로비는 /lobby 에 따로 있고, 옛 주소 /guide 는 여기로 영구 이동시킨다.
 */
const PILLARS: Array<{ title: string; desc: string }> = [
  {
    title: '방송 속 명장면을 그대로',
    desc: '인기 서바이벌 프로그램의 데스매치들을 1:1 맞대결로 즐길 수 있습니다.',
  },
  {
    title: '취향대로 골라 즐기는 다양한 장르',
    desc: '심리전, 추상전략, 수리, 언어, 관찰까지. 당신의 강점을 가장 잘 발휘할 수 있는 게임을 선택하세요.',
  },
];

const RANK_POINTS: Array<{ title: string; body: string }> = [
  {
    title: '매일 밤 펼쳐지는 랭크게임 (21:00 ~ 01:00)',
    body: '도전자들이 모이는 4시간. 매일 밤 열리는 랭크전에서 당신의 한계를 시험하세요. (주말은 24시간제로 운영됩니다.)',
  },
  {
    title: '치열한 밴픽 전략',
    body: '상대의 주종목을 차단하고, 자신 있는 게임으로 승기를 잡으세요. 각자 3개의 게임을 밴한 후, 남은 게임 중 추첨을 통해 종목이 선정됩니다.',
  },
  {
    title: '판을 뒤엎는 연승 보너스',
    body: '패배가 쌓였어도 포기는 금물. 연승을 거둘수록 RP 획득량이 폭발적으로 증가합니다.',
  },
  {
    title: '최고 명예와 시즌 한정 보상',
    body: '높은 티어에 도달할수록 더 명예로운 보상이 기다립니다. 시즌 종료 후 최상위 랭커만을 위한 스페셜 보상을 획득하세요.',
  },
];

function PeriodLines({ text, className }: { text: string; className?: string }) {
  const lines = text.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  return (
    <p className={className}>
      {lines.map((line, i) => (
        <span key={i} className={i === 0 ? 'block' : 'mt-1.5 block'}>
          {line}
        </span>
      ))}
    </p>
  );
}

type TitleSlotKind = 'normal' | 'hidden' | 'shop' | 'effect';

const TITLE_POINTS: Array<{ kind: TitleSlotKind; title: string; body: string }> = [
  {
    kind: 'normal',
    title: '일반 칭호',
    body: '운영자가 직접 부여하는, 유저의 특별한 업적을 기리는 희귀 칭호입니다.',
  },
  {
    kind: 'hidden',
    title: '히든 칭호',
    body: '숨겨진 비밀 조건을 스스로 파헤치고 달성해야만 열리는 특별한 칭호입니다.',
  },
  {
    kind: 'shop',
    title: '상점 칭호',
    body: '상점 로테이션 품목에서 입수할 수 있으며, 장착 시 해당 게임이 추첨될 확률이 증가합니다.',
  },
  {
    kind: 'effect',
    title: '이펙트',
    body: '보유한 칭호에 입히는 고유 시각 연출입니다. 상점 뽑기를 통해 기간제로 획득하거나, 챌린저 시즌 보상으로 영구 소장할 수도 있습니다.',
  },
];

const SHOP_POINTS: Array<{ title: string; body: string }> = [
  {
    title: 'CDP',
    body: '랭크 게임을 통해서만 획득할 수 있는 상점 포인트입니다.',
  },
  {
    title: '공정한 승부',
    body: '승패에 영향을 주는 아이템은 존재하지 않으며, 오직 개성과 성취를 나타내는 소모성 아이템과 칭호만 판매합니다.',
  },
  {
    title: '상점 칭호 & 소모품',
    body: '게임 추첨 확률을 높여주는 전략적 상점 칭호부터 다양한 소모성 아이템을 구매할 수 있습니다.',
  },
  {
    title: '뽑기 시스템',
    body: '1회당 80 CDP로 이용 가능하며, S등급부터 F등급까지 등급별 차등 확률로 희귀 아이템을 획득할 수 있습니다.',
  },
];

/** 소개 칭호 예시 — 개발자가 고정. DB/착용 상태를 따라가지 않는다. */
const TITLE_SAMPLES: Record<TitleSlotKind, IntroTitleModalData> = {
  normal: {
    id: 'intro-normal',
    name: '2023시즌 왕',
    color: 'gold',
    effect: null,
    description: '스타지니어스 2023시즌 왕 선발전 우승자',
    conditionText: null,
    isSystem: false,
    holderCount: 1,
    holders: [
      { member_id: 'intro-h-1', nickname: 'UzPlay', granted_at: '2026-05-01T16:55:25.000Z' },
    ],
  },
  hidden: {
    id: 'intro-hidden',
    name: '인고의 시간',
    color: 'rose',
    effect: null,
    description: '시계 바늘이 한 바퀴를 돌 때까지, 당신의 투지는 꺾이지 않았다.',
    conditionText: '최초로 1시간 이상 진행된 게임에서 승리한 플레이어',
    isSystem: true,
    holderCount: 1,
    holders: [
      { member_id: 'intro-h-2', nickname: '동현', granted_at: '2026-05-13T04:44:42.000Z' },
    ],
  },
  shop: {
    id: 'intro-shop',
    name: '포설러',
    color: 'pink',
    effect: null,
    description: '랭크 게임에서 \'포도설탕2\'가 추첨될 확률이 약간 증가합니다. (착용 시에만 적용)',
    conditionText: '상점에서 800 CDP 로 구매',
    isSystem: false,
    holderCount: 1,
    holders: [
      { member_id: 'intro-h-3', nickname: 'Raisy', granted_at: '2026-05-17T14:36:06.000Z' },
    ],
  },
  effect: {
    id: 'intro-effect',
    name: '천공의 주인',
    color: 'sky',
    effect: 'legend',
    description: '하늘 위에서 고고하게 빛나는 존재.',
    conditionText: '최초로 챌린저에서 70판 연속 플레이',
    isSystem: true,
    holderCount: 1,
    holders: [
      { member_id: 'intro-h-4', nickname: '푸린', granted_at: '2026-05-13T00:00:00.000Z' },
    ],
  },
};

/** 특징 목록의 말머리 — 방송/장르를 각각 형상화한 아이콘 대신 일반 점 불릿 */
function BulletMark() {
  return <span aria-hidden className="block h-2.5 w-2.5 rounded-full bg-current" />;
}

// 룰 본문은 관리자 저장 시 갱신되므로 주기적 재검증
export default async function IntroContent() {
  const siteUrl = getSiteUrl();

  /*
    룰이 등록된 종목을 룰지(RuleSheet)로 싣는다 — 배경 위에 본문을 진짜 텍스트로
    얹으므로 좁은 화면에서도 읽히고, 검색엔진도 그대로 수집한다.
    관리자가 룰을 저장하면 저장 API 가 이 경로를 재검증해 바로 반영된다.
  */
  const allRules = await fetchAllGameRules();
  const titleSlots = TITLE_SAMPLES;
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
          '1:1 심리·전략 진검승부 두뇌게임.',
        /*
          검색엔진이 이 사이트를 무엇으로 볼지에 쓰인다.
          <meta name="keywords"> 와 달리 구조화 데이터는 개체 인식에 실제로 참고된다.
          다만 순위를 만드는 건 본문이라, 프로그램명은 위 히어로 문단에도 함께 있다.
        */
        keywords: [
          '두뇌 서바이벌', '심리 게임', '전략 게임', '1:1 두뇌 게임',
          '더 지니어스', '지니어스', '데블스 플랜', '피의 게임', '피의 게임X',
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
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-cdm-ink">
      <AboutGNB />

      <main className="flex-1">
        {/* 히어로 — 그라데이션 + 잿불. 모바일은 로비처럼 문서 스크롤(주소창에 묶인 dvh 금지). */}
        <section className="guide-hero flex flex-col items-center justify-center px-4 py-20 text-center sm:min-h-[calc(100vh-3.5rem)]">
          <EmberField />

          <div className="relative z-10 mx-auto w-full max-w-3xl">
            <p
              className="intro-hero-in text-xs font-bold tracking-[0.4em] text-cdm-ink-fg-muted md:text-sm"
              style={{ ['--intro-hero-delay' as string]: '0.05s' }}
            >
              CUSTOM DEATHMATCH
            </p>
            {/* h1 에 브랜드명을 함께 둔다 — 브랜드 검색에서 본문 근거가 되도록 */}
            <h1 className="intro-hero-in mt-5" style={{ ['--intro-hero-delay' as string]: '0.15s' }}>
              <span className="block text-lg font-bold text-cdm-ink-fg md:text-xl">
                커스텀 데스매치
              </span>
              <span className="guide-title mt-2 block text-4xl leading-[1.15] font-black tracking-tight md:text-6xl">
                판을 읽는 자가
                <br />
                승리한다
              </span>
            </h1>
            <div
              className="intro-hero-in guide-rule-line mx-auto mt-7 w-40"
              style={{ ['--intro-hero-delay' as string]: '0.3s' }}
            />
            <p
              className="intro-hero-in mx-auto mt-7 max-w-xl text-base leading-relaxed text-cdm-ink-fg-muted md:text-lg"
              style={{ ['--intro-hero-delay' as string]: '0.38s' }}
            >
              더 지니어스, 데블스 플랜, 피의 게임 등 방송에서 나온 두뇌 서바이벌 게임부터, 유저들이 직접 만든 창작게임까지.
              <span className="mt-2 block">지금 직접 플레이어로 참여해보세요.</span>
            </p>

            <div
              className="intro-hero-in mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center"
              style={{ ['--intro-hero-delay' as string]: '0.5s' }}
            >
              <Link
                href="/lobby"
                className="guide-cta w-full rounded-xl px-8 py-3.5 text-center font-bold text-white transition sm:w-auto"
              >
                로비로 가기
              </Link>
              <Link
                href="/login"
                className="w-full rounded-xl bg-[#FEE500] px-8 py-3.5 text-center font-bold text-[#191919] transition hover:brightness-95 sm:w-auto"
              >
                카카오로 시작
              </Link>
            </div>
          </div>
        </section>

        <section
          id="platform"
          className="flex scroll-mt-14 flex-col items-center justify-center px-4 py-16 sm:min-h-[calc(100vh-3.5rem)] md:px-6"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="intro-reveal grid items-center gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
              <div className="guide-screen">
                <div className="guide-screen-frame">
                  <Image
                    src="/brand/intro-gameplay.png"
                    alt="사중력 사목 플레이 화면 — 돌을 놓고 중력을 고르는 1:1 대결"
                    width={649}
                    height={649}
                    className="guide-screen-img"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-cdm-ink-fg md:text-4xl">
                  방송으로만 보던 두뇌 게임,
                  <br />
                  이제 <span className="text-[#aeb2ff]">직접</span> 플레이하라.
                </h2>
                <p className="mt-5 text-sm leading-relaxed text-cdm-ink-fg-muted md:text-base">
                  매번 두뇌 서바이벌 프로그램을 시청하며 &lsquo;나라면 이렇게 했을 텐데&rsquo; 아쉬워하셨나요?
                  <span className="mt-2 block">
                    두뇌 서바이벌 속 전율 넘치는 명장면을 이제 당신의 플레이로 완성해보세요.
                  </span>
                </p>

                <ul className="mt-8 space-y-6">
                  {PILLARS.map((item) => (
                    <li key={item.title} className="flex gap-4">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(124,108,255,0.18)] text-[#aeb2ff]"
                      >
                        <BulletMark />
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-cdm-ink-fg md:text-lg">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-cdm-ink-fg-muted">
                          {item.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section
          id="rank"
          className="flex scroll-mt-14 flex-col items-center justify-center px-4 py-16 sm:min-h-[calc(100vh-3.5rem)] md:px-6"
        >
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="sr-only">랭크</h2>
            <div className="intro-reveal">
              <IntroRankPanel />
            </div>
            <p className="intro-reveal mt-10 text-2xl font-black tracking-tight text-cdm-ink-fg md:text-4xl">
              오직 실력으로 당신의 가치를 증명하라.
            </p>
            <ul className="intro-reveal mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {RANK_POINTS.map((item, i) => (
                <li key={item.title} className="intro-rank-slot">
                  <span className="intro-rank-num">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 text-lg font-black tracking-tight text-cdm-ink-fg md:text-xl">
                    {item.title}
                  </h3>
                  <PeriodLines
                    text={item.body}
                    className="mt-3 text-sm leading-relaxed text-cdm-ink-fg-muted"
                  />
                </li>
              ))}
            </ul>
            <Link href="/ranking" className="intro-rank-link mt-8">
              랭킹 보기
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>

        <section
          id="titles"
          className="flex scroll-mt-14 flex-col items-center justify-center px-4 py-10 sm:min-h-[calc(100vh-3.5rem)] sm:py-12 md:px-6"
        >
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="sr-only">칭호</h2>
            <p className="intro-reveal text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              위대한 업적을 세우고, 칭호를 획득하라.
            </p>
            <ul className="intro-reveal mt-6 grid gap-4 sm:grid-cols-2 sm:gap-4">
              {TITLE_POINTS.map((item) => (
                <li key={item.kind} className="intro-title-card">
                  <IntroTitlesPanel modal={titleSlots[item.kind]} />
                  <h3 className="mt-3 text-base font-black tracking-tight text-cdm-ink-fg md:text-lg">
                    {item.title}
                  </h3>
                  <PeriodLines
                    text={item.body}
                    className="mt-1.5 text-sm leading-relaxed text-cdm-ink-fg-muted"
                  />
                </li>
              ))}
            </ul>
            <Link href="/titles" className="intro-rank-link mt-6">
              칭호 보기
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>

        <section
          id="shop"
          className="flex scroll-mt-14 flex-col items-center justify-center px-4 py-10 sm:min-h-[calc(100vh-3.5rem)] sm:py-12 md:px-6"
        >
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="sr-only">상점</h2>
            <p className="intro-reveal text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              랭크 게임으로 재화를 벌고, 원하는 아이템을 구매하라.
            </p>
            <ul className="intro-reveal mt-6 grid grid-cols-1 gap-3">
              {SHOP_POINTS.map((item) => (
                <li key={item.title} className="intro-rank-slot">
                  <h3 className="text-base font-black tracking-tight text-cdm-ink-fg md:text-lg">
                    {item.title}
                  </h3>
                  <PeriodLines
                    text={item.body}
                    className="mt-1.5 text-sm leading-relaxed text-cdm-ink-fg-muted"
                  />
                </li>
              ))}
            </ul>
            <Link href="/shop" className="intro-rank-link mt-6">
              상점 가기
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>

        <section
          id="guild"
          className="flex scroll-mt-14 flex-col items-center justify-center px-4 py-10 sm:min-h-[calc(100vh-3.5rem)] sm:py-12 md:px-6"
        >
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="intro-reveal text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              길드 시스템
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-cdm-ink-fg-muted md:text-lg">
              현재 길드 전용 콘텐츠를 준비하고 있습니다.
              <span className="mt-2 block">더욱 완벽한 환경으로 찾아뵐 예정이니 기대해 주세요.</span>
            </p>
            <Link href="/guild" className="intro-rank-link mt-8">
              길드 가기
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>

        <section
          id="rules"
          className="flex scroll-mt-14 flex-col items-center justify-center px-4 py-16 sm:min-h-[calc(100vh-3.5rem)] md:px-6"
        >
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="intro-reveal text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              게임 룰
            </h2>
            <div className="mt-6">
              <IntroRulesPanel items={ruleItems} />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20">
          {/* 하단 CTA */}
          <section className="intro-reveal guide-card rounded-2xl px-8 py-12 text-center">
            <h2 className="text-2xl font-black tracking-tight text-cdm-ink-fg md:text-3xl">
              지금 바로 치열한 승부에 도전하라.
            </h2>
            <Link
              href="/login"
              className="guide-cta mt-8 inline-block rounded-xl px-9 py-3.5 font-bold text-white transition"
            >
              로그인하기
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
