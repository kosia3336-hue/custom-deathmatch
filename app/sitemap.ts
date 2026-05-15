import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

interface NoticeRow {
  id: string;
  updated_at: string;
}

const STATIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
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

  return [...staticEntries, ...noticeEntries];
}
