import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import type { GameRuleMeta } from '@/lib/gameRules';
import AdminGameRulesEditor from './AdminGameRulesEditor';

/** 관리자 — 게임 룰 작성 탭 (서버: 저장된 텍스트/메타 로드) */
export default async function GameRulesTab() {
  const texts: Record<string, string> = {};
  const meta: Record<string, GameRuleMeta> = {};
  const updatedAt: Record<string, string> = {};
  const images: Record<string, string> = {};

  if (isSupabaseServiceRoleConfigured()) {
    const sb = getSupabaseServiceRole();
    const { data } = await sb
      .from('game_rule_texts')
      .select('game_id, rules, source, origin_url, original_author, poster, updated_at, image_url');
    for (const r of (data ?? []) as {
      game_id: string;
      rules: string;
      source: string;
      origin_url: string;
      original_author: string;
      poster: string;
      updated_at: string;
      image_url: string | null;
    }[]) {
      texts[r.game_id] = r.rules;
      meta[r.game_id] = {
        source: r.source ?? '',
        originUrl: r.origin_url ?? '',
        originalAuthor: r.original_author ?? '',
        poster: r.poster ?? '',
      };
      updatedAt[r.game_id] = r.updated_at;
      images[r.game_id] = r.image_url ?? '';
    }
  }

  return (
    <AdminGameRulesEditor
      initialTexts={texts}
      initialMeta={meta}
      initialUpdatedAt={updatedAt}
      initialImages={images}
    />
  );
}
