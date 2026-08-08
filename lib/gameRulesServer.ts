/**
 * 게임 룰 텍스트 서버 조회 — 룰 페이지(SSR/SEO)용.
 *
 * game_rule_texts 는 RLS 상 공개 읽기(SELECT USING true)라 anon 키로 조회 가능하다.
 * 클라이언트 fetch(/api/game-rules) 와 달리 서버에서 읽어 HTML 에 그대로 담기므로
 * 검색엔진이 룰 본문을 수집할 수 있다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseUrl, getSupabaseAnonKey, isSupabaseConfigured } from '@/lib/supabase/env';
import { EMPTY_RULE_META, type GameRuleMeta } from '@/lib/gameRules';

export interface GameRuleContent {
  rules: string;
  meta: GameRuleMeta;
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

/* ── 룰 이미지 ───────────────────────────────────────────────────
   public/rules/<gameId>.webp 의 "파일 존재" 자체가 유일한 기준이다.
   이미지를 넣기만 하면 룰 상세 페이지(/rules/[gameId])와 소개 페이지의
   룰 섹션에 코드 수정 없이 함께 반영된다.
   (fs 를 쓰므로 이 모듈은 서버에서만 import 해야 한다 — lib/gameRules.ts 는
    클라이언트 컴포넌트도 쓰기 때문에 그쪽에 두면 번들이 깨진다.)
   ────────────────────────────────────────────────────────────── */

const RULE_IMAGE_EXT = '.webp';
let ruleImageIdsCache: Set<string> | null = null;

/** 룰 이미지가 실제로 존재하는 게임 id 집합 */
export function getRuleImageIds(): Set<string> {
  // 운영에서는 릴리스 중 파일이 바뀌지 않으므로 캐시한다.
  // 개발 중에는 이미지를 새로 넣자마자 반영되도록 매번 읽는다.
  if (ruleImageIdsCache && process.env.NODE_ENV === 'production') return ruleImageIdsCache;

  let ids: Set<string>;
  try {
    const dir = path.join(process.cwd(), 'public', 'rules');
    ids = new Set(
      fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(RULE_IMAGE_EXT))
        .map((f) => f.slice(0, -RULE_IMAGE_EXT.length)),
    );
  } catch {
    // 디렉터리가 아직 없으면 이미지 없음으로 취급 — 페이지는 텍스트로 정상 동작
    ids = new Set();
  }

  ruleImageIdsCache = ids;
  return ids;
}

export function hasRuleImage(gameId: string): boolean {
  return getRuleImageIds().has(gameId);
}

interface RuleRow {
  game_id: string;
  rules: string;
  source: string;
  origin_url: string;
  original_author: string;
  poster: string;
}

const SELECT_COLS = 'game_id, rules, source, origin_url, original_author, poster';

function toContent(row: RuleRow): GameRuleContent {
  return {
    rules: row.rules ?? '',
    meta: {
      source: row.source ?? '',
      originUrl: row.origin_url ?? '',
      originalAuthor: row.original_author ?? '',
      poster: row.poster ?? '',
    },
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
    const { data } = await sb
      .from('game_rule_texts')
      .select(SELECT_COLS)
      .eq('game_id', gameId)
      .maybeSingle();
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
    const { data } = await sb.from('game_rule_texts').select(SELECT_COLS);
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
