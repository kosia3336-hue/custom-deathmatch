/**
 * 게임 룰 텍스트 서버 조회 — 룰 페이지(SSR/SEO)용.
 *
 * game_rule_texts 는 RLS 상 공개 읽기(SELECT USING true)라 anon 키로 조회 가능하다.
 * 클라이언트 fetch(/api/game-rules) 와 달리 서버에서 읽어 HTML 에 그대로 담기므로
 * 검색엔진이 룰 본문을 수집할 수 있다.
 *
 * 조회 결과는 여기서 캐시한다. supabase-js 의 fetch 는 Next 16 기준 캐시되지
 * 않아서, 이걸 그대로 쓰면 룰을 읽는 페이지가 전부 동적이 되고 요청마다 DB 를
 * 친다. 페이지에 revalidate 를 걸어도 소용이 없다 — 캐시할 대상이 없어서다.
 * 그래서 페이지가 아니라 데이터에 캐시를 건다.
 *
 * 관리자가 룰을 저장하면 GAME_RULES_TAG 를 무효화해 즉시 반영한다.
 */

import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseUrl, getSupabaseAnonKey, isSupabaseConfigured } from '@/lib/supabase/env';
import { EMPTY_RULE_META, GAME_RULES, getGameRule, type GameRuleMeta } from '@/lib/gameRules';

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

function localContent(gameId: string): GameRuleContent | null {
  const rule = getGameRule(gameId);
  if (!rule) return null;
  return { rules: rule.rules, meta: { ...EMPTY_RULE_META }, imageUrl: '' };
}

/** 익명 읽기 전용 클라이언트 (쿠키/세션 불필요 — 정적 성격의 공개 데이터) */
function getReadClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false },
  });
}

/** 룰 캐시 무효화 태그 — 관리자 저장 시 revalidateTag 로 함께 비운다. */
export const GAME_RULES_TAG = 'game-rules';

/** 룰은 관리자가 가끔 고치는 공개 데이터다. 5분이면 충분히 신선하다. */
const CACHE_TTL_SECONDS = 300;

/** 게임 하나의 룰 본문 + 메타. 없으면 null */
async function readGameRule(gameId: string): Promise<GameRuleContent | null> {
  if (!isSupabaseConfigured()) return localContent(gameId);
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
    if (!row) return localContent(gameId);
    return toContent(row);
  } catch {
    return localContent(gameId);
  }
}

/** 전체 게임의 룰 본문 + 메타 (gameId 키) */
async function readAllGameRules(): Promise<Record<string, GameRuleContent>> {
  const local = Object.fromEntries(
    GAME_RULES.map((rule) => [
      rule.id,
      { rules: rule.rules, meta: { ...EMPTY_RULE_META }, imageUrl: '' },
    ]),
  );
  if (!isSupabaseConfigured()) return local;
  try {
    const sb = getReadClient();
    let { data, error } = await sb.from('game_rule_texts').select(SELECT_COLS);
    if (error && isMissingImageColumn(error)) {
      ({ data, error } = await sb.from('game_rule_texts').select(BASE_COLS));
    }
    const out: Record<string, GameRuleContent> = local;
    for (const row of (data ?? []) as unknown as RuleRow[]) {
      out[row.game_id] = toContent(row);
    }
    return out;
  } catch {
    return local;
  }
}

/*
  unstable_cache 는 함수 인자를 캐시 키에 함께 넣으므로 gameId 별로 따로 잡힌다.
*/
export const fetchGameRule = unstable_cache(readGameRule, ['game-rule'], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [GAME_RULES_TAG],
});

export const fetchAllGameRules = unstable_cache(readAllGameRules, ['game-rules-all'], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [GAME_RULES_TAG],
});

export { EMPTY_RULE_META };
