import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import GNB from '@/components/layout/GNB';
import { MarkdownView, extractPlainText } from '@/lib/markdown';
import {
  GAME_RULES,
  getGameRule,
  ruleImagePath,
  RULE_IMAGE_WIDTH,
  RULE_IMAGE_HEIGHT,
} from '@/lib/gameRules';
import { fetchGameRule, fetchAllGameRules, hasMeaningfulRule } from '@/lib/gameRulesServer';
import { getSiteUrl, jsonLdScript } from '@/lib/site';
import { cn } from '@/lib/utils';

interface Props {
  params: Promise<{ gameId: string }>;
}

/** 정적 경로 — 게임 목록은 코드에 고정이므로 전부 미리 생성 */
export function generateStaticParams() {
  return GAME_RULES.map((g) => ({ gameId: g.id }));
}

// 룰 본문은 관리자 저장 시 갱신되어야 하므로 주기적 재검증
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  const game = getGameRule(gameId);
  if (!game) return { title: '게임 룰' };

  const content = await fetchGameRule(gameId);
  const body = content?.rules?.trim() ?? '';
  const description = hasMeaningfulRule(body)
    ? extractPlainText(body, 155)
    : `${game.name} 룰 — 커스텀 데스매치에서 즐기는 1:1 ${game.category} 게임의 규칙을 확인하세요.`;

  return {
    title: `${game.name} 룰`,
    description,
    alternates: { canonical: `/rules/${gameId}` },
    openGraph: {
      title: `${game.name} 룰 | 커스텀 데스매치`,
      description,
      type: 'article',
      // 룰 이미지가 있으면 공유 카드 썸네일로 그대로 쓴다
      ...(game.hasImage
        ? {
            images: [
              {
                url: ruleImagePath(gameId),
                width: RULE_IMAGE_WIDTH,
                height: RULE_IMAGE_HEIGHT,
                alt: `${game.name} 룰`,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function GameRulePage({ params }: Props) {
  const { gameId } = await params;
  const game = getGameRule(gameId);
  if (!game) notFound();

  const all = await fetchAllGameRules();
  const content = all[gameId] ?? (await fetchGameRule(gameId));
  const source = content?.rules?.trim() ?? '';
  const meta = content?.meta;
  const hasRules = hasMeaningfulRule(source);
  const hasImage = game.hasImage === true;
  const imageSrc = ruleImagePath(gameId);
  const hasMeta = Boolean(
    meta && (meta.source || meta.originUrl || meta.originalAuthor || meta.poster),
  );

  // 이전/다음 이동 — 룰이 등록된 게임끼리만 순환한다(빈 페이지로 넘어가지 않도록).
  const navList = GAME_RULES.filter((g) => hasMeaningfulRule(all[g.id]?.rules));
  const list = navList.length > 1 ? navList : GAME_RULES;
  const idx = list.findIndex((g) => g.id === gameId);
  // 목록에 없는 게임(룰 미등록)이라면 막다른 길이 되지 않도록 첫 룰로 안내
  const prev = idx >= 0 ? list[(idx - 1 + list.length) % list.length] : undefined;
  const next = idx >= 0 ? list[(idx + 1) % list.length] : list[0];

  const siteUrl = getSiteUrl().replace(/\/$/, '');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${game.name} 룰`,
    description: hasRules
      ? extractPlainText(source, 155)
      : `${game.name} — 커스텀 데스매치의 1:1 ${game.category} 게임.`,
    inLanguage: 'ko-KR',
    mainEntityOfPage: `${siteUrl}/rules/${gameId}`,
    ...(meta?.originalAuthor ? { author: { '@type': 'Person', name: meta.originalAuthor } } : {}),
    publisher: { '@type': 'Organization', name: '커스텀 데스매치' },
  };

  return (
    <div className="flex min-h-screen flex-col bg-cdm-page">
      <GNB />

      {/* 룰 이미지가 있으면 이미지 안의 글씨가 잘 보이도록 본문 폭을 넓힌다 */}
      <main
        className={cn(
          'mx-auto w-full flex-1 px-4 py-6 md:px-6 md:py-10',
          hasImage ? 'max-w-5xl' : 'max-w-3xl',
        )}
      >
        {/* 브레드크럼 */}
        <nav className="mb-4 text-sm text-cdm-fg-muted">
          <Link href="/rules" className="hover:text-cdm-fg hover:underline">
            게임 룰
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-cdm-fg">{game.name}</span>
        </nav>

        <header className="mb-6 border-b border-cdm-border pb-5">
          <span className="inline-block rounded-lg bg-cdm-primary-soft px-2.5 py-1 text-xs font-bold text-cdm-primary-strong">
            {game.category}
          </span>
          <h1 className="mt-2.5 text-2xl font-extrabold text-cdm-fg sm:text-3xl">
            {game.name} 룰
          </h1>
        </header>

        {hasImage || hasRules ? (
          <article>
            {/* 룰 이미지 — 사용자는 기본적으로 이미지를 본다.
                본문 텍스트는 아래 접이식 영역에 그대로 남아 크롤러가 수집한다. */}
            {hasImage && (
              <figure className="mb-6">
                <a
                  href={imageSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-cdm-md border border-cdm-border transition hover:border-cdm-primary"
                >
                  <Image
                    src={imageSrc}
                    alt={`${game.name} 룰 안내 이미지 — 아래 '룰 텍스트로 보기'에 같은 내용이 글로 있습니다.`}
                    width={RULE_IMAGE_WIDTH}
                    height={RULE_IMAGE_HEIGHT}
                    priority
                    // 글씨가 빽빽한 이미지라 재인코딩(기본 q75)하면 글자가 뭉갠다.
                    // 원본이 이미 표시 해상도에 맞춘 webp(약 100~124KB)이므로 그대로 서빙한다.
                    unoptimized
                    className="h-auto w-full"
                  />
                </a>
                <figcaption className="mt-2 text-center text-xs text-cdm-fg-muted">
                  글씨가 작다면 이미지를 눌러 원본 크기로 볼 수 있어요.
                </figcaption>
              </figure>
            )}

            {hasRules &&
              (hasImage ? (
                <details className="group rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1">
                  <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-bold text-cdm-fg transition hover:text-cdm-primary [&::-webkit-details-marker]:hidden">
                    <span>룰 텍스트로 보기</span>
                    <span
                      aria-hidden
                      className="text-cdm-fg-muted transition-transform group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <div className="border-t border-cdm-border px-4 py-4">
                    <MarkdownView source={source} />
                  </div>
                </details>
              ) : (
                <MarkdownView source={source} />
              ))}

            {hasMeta && (
              <div className="mt-8 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-4 text-xs leading-relaxed text-cdm-fg-muted">
                {meta!.source && <p>출처: {meta!.source}</p>}
                {meta!.originalAuthor && <p>원작자: {meta!.originalAuthor}</p>}
                {meta!.poster && <p>게시자: {meta!.poster}</p>}
                {meta!.originUrl && (
                  <p className="truncate">
                    원본 룰:{' '}
                    <a
                      href={meta!.originUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cdm-primary underline underline-offset-2"
                    >
                      {meta!.originUrl}
                    </a>
                  </p>
                )}
              </div>
            )}
          </article>
        ) : (
          <p className="py-12 text-center text-sm text-cdm-fg-muted">
            아직 룰이 준비 중입니다.
          </p>
        )}

        {/* 이전 / 다음 룰 이동 */}
        {(prev || next) && (
          <nav
            aria-label="다른 게임 룰"
            className="mt-10 grid gap-3 border-t border-cdm-border pt-6 sm:grid-cols-2"
          >
            {prev ? (
              <Link
                href={`/rules/${prev.id}`}
                rel="prev"
                className="group flex items-center gap-3 rounded-xl border border-cdm-border p-4 transition hover:border-cdm-primary hover:bg-cdm-bg-elev-1"
              >
                <span
                  aria-hidden
                  className="text-xl text-cdm-fg-muted transition group-hover:text-cdm-primary"
                >
                  ←
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-cdm-fg-muted">이전 룰</span>
                  <span className="block truncate font-bold text-cdm-fg">{prev.name}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/rules/${next.id}`}
                rel="next"
                className="group flex items-center justify-end gap-3 rounded-xl border border-cdm-border p-4 text-right transition hover:border-cdm-primary hover:bg-cdm-bg-elev-1"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-cdm-fg-muted">다음 룰</span>
                  <span className="block truncate font-bold text-cdm-fg">{next.name}</span>
                </span>
                <span
                  aria-hidden
                  className="text-xl text-cdm-fg-muted transition group-hover:text-cdm-primary"
                >
                  →
                </span>
              </Link>
            )}
          </nav>
        )}

        {/* 하단 내비 */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Link
            href="/rules"
            className="rounded-xl border border-cdm-border px-5 py-2.5 text-center text-sm font-semibold text-cdm-fg transition hover:bg-cdm-bg-elev-1"
          >
            ← 전체 게임 룰
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-cdm-primary px-5 py-2.5 text-center text-sm font-bold text-cdm-fg-inverse transition hover:opacity-90"
          >
            이 게임 플레이하기
          </Link>
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
