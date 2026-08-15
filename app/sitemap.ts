import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { GAME_RULES } from '@/lib/gameRules';

interface NoticeRow {
  id: string;
  updated_at: string;
}

const STATIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  // '/' 는 로그인 사용자의 로비이고 비로그인·크롤러는 '/guide' 로 307 리다이렉트된다.
  // 사이트맵에 리다이렉트되는 URL 을 실으면 Search Console 이 '리다이렉션이 포함된
  // 페이지' 로 잡으므로, 실제로 200 을 주는 대표 URL 인 '/guide' 를 싣는다.
  { path: '/guide', changeFrequency: 'daily', priority: 1.0 },
  { path: '/rules', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/ranking', changeFrequency: 'hourly', priority: 0.8 },
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

  // 게임별 룰 페이지 — 검색 유입의 핵심 콘텐츠
  const ruleEntries: MetadataRoute.Sitemap = GAME_RULES.map((g) => ({
    url: `${base}/rules/${g.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

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
      .limit(1000);
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
