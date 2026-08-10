/**
 * 게임 룰 텍스트 서버 조회 — 룰 페이지(SSR/SEO)용.
 *
 * game_rule_texts 는 RLS 상 공개 읽기(SELECT USING true)라 anon 키로 조회 가능하다.
 * 클라이언트 fetch(/api/game-rules) 와 달리 서버에서 읽어 HTML 에 그대로 담기므로
 * 검색엔진이 룰 본문을 수집할 수 있다.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseUrl, getSupabaseAnonKey, isSupabaseConfigured } from '@/lib/supabase/env';
import { EMPTY_RULE_META, type GameRuleMeta } from '@/lib/gameRules';

export interface GameRuleContent {
  rules: string;
  meta: GameRuleMeta;
  /** 룰 이미지 URL. 빈 문자열이면 이미지 없음 (관리자 페이지에서 등록/교체) */
  imageUrl: string;
}

/**
 * 실제로 읽을 내용이 있는 룰인지 판정.
 * 관리자가 자리표시자로 넣어 둔 "." 같은 값은 빈 룰로 취급한다.
 */
export function hasMeaningfulRule(rules: string | undefined | null): boolean {
  if (!rules) return false;
  // 마크다운 기호/공백을 걷어낸 뒤 남는 실질 문자 수로 판단
  const plain = rules.replace(/[\s.\-_*#>~`|[\]()!]/g, '');
  return plain.length >= 10;
}

interface RuleRow {
  game_id: string;
  rules: string;
  source: string;
  origin_url: string;
  original_author: string;
  poster: string;
  image_url: string | null;
}

const BASE_COLS = 'game_id, rules, source, origin_url, original_author, poster';
const SELECT_COLS = `${BASE_COLS}, image_url`;

/**
 * image_url 컬럼이 아직 없는 DB(마이그레이션 전)에서도 룰 본문은 그대로 보여준다.
 * 컬럼 하나 때문에 조회가 통째로 실패해 모든 게임 룰이 '준비 중'으로 보이는 일이
 * 없도록, 실패하면 컬럼을 빼고 한 번 더 조회한다.
 */
function isMissingImageColumn(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes('image_url'));
}

function toContent(row: RuleRow): GameRuleContent {
  return {
    rules: row.rules ?? '',
    meta: {
      source: row.source ?? '',
      originUrl: row.origin_url ?? '',
      originalAuthor: row.original_author ?? '',
      poster: row.poster ?? '',
    },
    imageUrl: row.image_url ?? '',
  };
}

/** 익명 읽기 전용 클라이언트 (쿠키/세션 불필요 — 정적 성격의 공개 데이터) */
function getReadClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
  });
}

/** 게임 하나의 룰 본문 + 메타. 없으면 null */
export async function fetchGameRule(gameId: string): Promise<GameRuleContent | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getReadClient();
    let { data, error } = await sb
      .from('game_rule_texts')
      .select(SELECT_COLS)
      .eq('game_id', gameId)
      .maybeSingle();
    if (error && isMissingImageColumn(error)) {
      ({ data, error } = await sb
        .from('game_rule_texts')
        .select(BASE_COLS)
        .eq('game_id', gameId)
        .maybeSingle());
    }
    const row = data as unknown as RuleRow | null;
    if (!row) return null;
    return toContent(row);
  } catch {
    return null;
  }
}

/** 전체 게임의 룰 본문 + 메타 (gameId 키) */
export async function fetchAllGameRules(): Promise<Record<string, GameRuleContent>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const sb = getReadClient();
    let { data, error } = await sb.from('game_rule_texts').select(SELECT_COLS);
    if (error && isMissingImageColumn(error)) {
      ({ data, error } = await sb.from('game_rule_texts').select(BASE_COLS));
    }
    const out: Record<string, GameRuleContent> = {};
    for (const row of (data ?? []) as unknown as RuleRow[]) {
      out[row.game_id] = toContent(row);
    }
    return out;
  } catch {
    return {};
  }
}

export { EMPTY_RULE_META };
