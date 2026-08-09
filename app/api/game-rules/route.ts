import { NextResponse } from 'next/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import type { GameRuleMeta } from '@/lib/gameRules';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game-rules — 게임별 룰 텍스트 + 메타 + 룰 이미지 URL (공개).
 * {texts: {gameId: markdown}, meta: {gameId: {...}}, images: {gameId: url}}
 *
 * images 는 관리자 페이지에서 등록한 룰 이미지 URL 이다.
 */
export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ texts: {}, meta: {}, images: {} });
  }
  try {
    const sb = getSupabaseServiceRole();
    const { data } = await sb
      .from('game_rule_texts')
      .select('game_id, rules, source, origin_url, original_author, poster, image_url');
    const texts: Record<string, string> = {};
    const meta: Record<string, GameRuleMeta> = {};
    const images: Record<string, string> = {};
    for (const r of (data ?? []) as {
      game_id: string;
      rules: string;
      source: string;
      origin_url: string;
      original_author: string;
      poster: string;
      image_url: string | null;
    }[]) {
      if (r.rules.trim()) texts[r.game_id] = r.rules;
      if (r.image_url) images[r.game_id] = r.image_url;
      if (r.source || r.origin_url || r.original_author || r.poster) {
        meta[r.game_id] = {
          source: r.source,
          originUrl: r.origin_url,
          originalAuthor: r.original_author,
          poster: r.poster,
        };
      }
    }
    return NextResponse.json(
      { texts, meta, images },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json({ texts: {}, meta: {}, images: {} });
  }
}
