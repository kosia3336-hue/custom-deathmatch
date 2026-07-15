import { NextResponse } from 'next/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import type { GameRuleMeta } from '@/lib/gameRules';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game-rules — 게임별 룰 텍스트 + 메타 (공개).
 * {texts: {gameId: markdown}, meta: {gameId: {source, originUrl, originalAuthor, poster}}}
 */
export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ texts: {}, meta: {} });
  }
  try {
    const sb = getSupabaseServiceRole();
    const { data } = await sb
      .from('game_rule_texts')
      .select('game_id, rules, source, origin_url, original_author, poster');
    const texts: Record<string, string> = {};
    const meta: Record<string, GameRuleMeta> = {};
    for (const r of (data ?? []) as {
      game_id: string;
      rules: string;
      source: string;
      origin_url: string;
      original_author: string;
      poster: string;
    }[]) {
      if (r.rules.trim()) texts[r.game_id] = r.rules;
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
      { texts, meta },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json({ texts: {}, meta: {} });
  }
}
