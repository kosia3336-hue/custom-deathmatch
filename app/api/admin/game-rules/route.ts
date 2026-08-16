import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
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
  imageUrl?: string;
}

/** POST /api/admin/game-rules — 게임 룰 텍스트 + 메타 저장 (upsert) */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const gameId = String(body.gameId ?? '');
  if (!getGameRule(gameId)) {
    return NextResponse.json({ error: '알 수 없는 게임입니다.' }, { status: 400 });
  }
  const rules = String(body.rules ?? '');
  if (rules.length > 20000) {
    return NextResponse.json({ error: '룰 텍스트는 20,000자 이하로 작성해 주세요.' }, { status: 400 });
  }
  const source = String(body.source ?? '').slice(0, 200);
  const originUrl = String(body.originUrl ?? '').trim().slice(0, 500);
  if (originUrl && !/^https?:\/\//i.test(originUrl)) {
    return NextResponse.json({ error: '원본 룰 링크는 http(s) URL 이어야 합니다.' }, { status: 400 });
  }
  const originalAuthor = String(body.originalAuthor ?? '').slice(0, 100);
  const poster = String(body.poster ?? '').slice(0, 100);
  // 룰 이미지 — 업로드 엔드포인트가 돌려준 URL 이거나, 저장소에 있는 /rules/... 경로.
  // 빈 문자열이면 '이미지 없음' 으로 저장된다(관리자가 지운 경우).
  const imageUrl = String(body.imageUrl ?? '').trim().slice(0, 1000);
  if (imageUrl && !/^(https?:\/\/|\/)/.test(imageUrl)) {
    return NextResponse.json({ error: '이미지 주소가 올바르지 않습니다.' }, { status: 400 });
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.from('game_rule_texts') as any).upsert({
    game_id: gameId,
    rules,
    source,
    origin_url: originUrl,
    original_author: originalAuthor,
    poster,
    image_url: imageUrl,
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  });
  if (error) {
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
  }

  // 룰이 새로 등록/수정되면 소개 페이지와 룰 페이지에 즉시 반영한다.
  // (각 페이지의 revalidate 주기를 기다리지 않도록 저장 시점에 캐시를 무효화)
  revalidatePath('/about');
  revalidatePath('/rules');
  revalidatePath(`/rules/${gameId}`);

  return NextResponse.json({ ok: true });
}
