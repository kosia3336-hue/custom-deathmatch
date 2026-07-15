import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { getGameRule } from '@/lib/gameRules';

export const dynamic = 'force-dynamic';

interface Body {
  gameId?: string;
  rules?: string;
  source?: string;
  originUrl?: string;
  originalAuthor?: string;
  poster?: string;
}

/** POST /api/admin/game-rules — 게임 룰 텍스트 + 메타 저장 (upsert) */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없어요.' }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
  }

  const gameId = String(body.gameId ?? '');
  if (!getGameRule(gameId)) {
    return NextResponse.json({ error: '알 수 없는 게임이에요.' }, { status: 400 });
  }
  const rules = String(body.rules ?? '');
  if (rules.length > 20000) {
    return NextResponse.json({ error: '룰 텍스트는 20,000자 이하로 작성해 주세요.' }, { status: 400 });
  }
  const source = String(body.source ?? '').slice(0, 200);
  const originUrl = String(body.originUrl ?? '').trim().slice(0, 500);
  if (originUrl && !/^https?:\/\//i.test(originUrl)) {
    return NextResponse.json({ error: '원본 룰 링크는 http(s) URL 이어야 해요.' }, { status: 400 });
  }
  const originalAuthor = String(body.originalAuthor ?? '').slice(0, 100);
  const poster = String(body.poster ?? '').slice(0, 100);

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('game_rule_texts') as any).upsert({
    game_id: gameId,
    rules,
    source,
    origin_url: originUrl,
    original_author: originalAuthor,
    poster,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  });
  if (error) {
    return NextResponse.json({ error: '저장에 실패했어요.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
