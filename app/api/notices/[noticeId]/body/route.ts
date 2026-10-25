import { NextResponse } from 'next/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { body: string; until: number }>();

/**
 * GET /api/notices/:id/body — 게시된 공지 본문.
 *
 * 우편함 목록은 공지 앞부분만 싣는다(전송량 절약, db/mailbox_notice_preview.sql).
 * 공지 편지를 열 때 여기서 본문을 받는다. 공지 본문은 자주 바뀌지 않아 5분 기억한다 —
 * 여러 사람이 같은 공지를 열어도 Supabase 에는 5분에 한 번만 묻는다.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ noticeId: string }> }) {
  const { noticeId } = await ctx.params;
  if (!UUID_RE.test(noticeId)) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const now = Date.now();
  const hit = cache.get(noticeId);
  if (hit && hit.until > now) return reply(hit.body);

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRole() as any;
  const { data, error } = await db
    .from('notices')
    .select('body')
    .eq('id', noticeId)
    .eq('is_published', true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = String(data.body ?? '');
  if (cache.size >= 500) cache.clear();
  cache.set(noticeId, { body, until: now + TTL_MS });
  return reply(body);
}

function reply(body: string) {
  return NextResponse.json({ body }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
