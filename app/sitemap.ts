import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { GAME_RULES } from '@/lib/gameRules';
import { isUnreleasedGame } from '@/lib/unreleasedGames';

interface NoticeRow {
  id: string;
  updated_at: string;
}

const STATIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  // '/about' 이 소개이자 대표 URL. '/' 는 소개를 rewrite 로 그대로 보여주지만
  // canonical 이 '/about' 이므로 사이트맵에는 canonical 쪽만 싣는다.
  // 로비(/lobby)는 방 목록이 계속 바뀌는 앱 화면이라 noindex.
  // 옛 주소 /guide 는 '/about' 으로 308 이동하므로 싣지 않는다.
  { path: '/about', changeFrequency: 'daily', priority: 1.0 },
  { path: '/rules', changeFrequency: 'weekly', priority: 0.8 },
  // 랭킹은 순위 숫자만 바뀌는 얇은 문서다. 'hourly' 로 자주 부르면 크롤 예산만
  // 먹고, 정작 룰 페이지가 뒤로 밀린다.
  { path: '/ranking', changeFrequency: 'daily', priority: 0.6 },
  { path: '/notice', changeFrequency: 'daily', priority: 0.7 },
  { path: '/legal/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legal/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/legal/marketing', changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().replace(/\/$/, '');
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // 게임별 룰 페이지 — 검색 유입의 핵심 콘텐츠.
  // 출시 전 게임은 빼둔다. 색인되면 감춘 의미가 없다.
  const ruleEntries: MetadataRoute.Sitemap = GAME_RULES.filter(
    (g) => !isUnreleasedGame(g.id),
  ).map((g) => ({
    url: `${base}/rules/${g.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  /*
    공지는 최근 것만 싣는다.

    전체를 실었을 때 사이트맵 72개 중 41개(57%)가 공지였다. 대부분 400자대
    점검 안내라 색인 가치가 거의 없는데, 신생 사이트의 적은 크롤 예산을 그쪽이
    먼저 먹는다. 그러면 정작 검색 유입을 만들 룰 페이지가 뒤로 밀린다.
    지난 공지도 /notice 목록에서 링크되므로 크롤 자체는 계속 가능하다.
  */
  const NOTICE_SITEMAP_LIMIT = 10;

  let noticeEntries: MetadataRoute.Sitemap = [];
  try {
    const sb = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const res = await sb
      .from('notices')
      .select('id, updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(NOTICE_SITEMAP_LIMIT);
    const rows = (res.data ?? []) as unknown as NoticeRow[];
    noticeEntries = rows.map((row) => ({
      url: `${base}/notice/${row.id}`,
      lastModified: new Date(row.updated_at),
      changeFrequency: 'weekly',
      priority: 0.5,
    }));
  } catch (e) {
    console.error('[sitemap] notices fetch failed', e);
  }

  return [...staticEntries, ...ruleEntries, ...noticeEntries];
}
