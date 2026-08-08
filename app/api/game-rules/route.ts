import { NextResponse } from 'next/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import type { GameRuleMeta } from '@/lib/gameRules';
import { getRuleImageIds } from '@/lib/gameRulesServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/game-rules — 게임별 룰 텍스트 + 메타 + 룰 이미지 보유 목록 (공개).
 * {texts: {gameId: markdown}, meta: {gameId: {...}}, imageIds: [gameId]}
 *
 * imageIds 는 public/rules/<gameId>.webp 존재 여부를 서버에서 확인한 결과다.
 * 클라이언트(룰 모달)는 fs 를 볼 수 없으므로 이 목록으로 이미지 유무를 판단한다
 * — 이미지를 새로 넣으면 모달에도 코드 수정 없이 반영된다.
 */
export async function GET() {
  const imageIds = [...getRuleImageIds()];

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ texts: {}, meta: {}, imageIds });
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
      { texts, meta, imageIds },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json({ texts: {}, meta: {}, imageIds });
  }
}
