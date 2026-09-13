import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import {
  createResultShareToken,
  getResultShareSecret,
  type SharePosition,
} from '@/lib/share/resultToken';

/** 방금 끝난 판으로 볼 기록 시각 범위 */
const RECENT_MS = 10 * 60 * 1000;

/**
 * 게임 종료 화면용 결과 공유 링크 발급.
 * 결과 화면은 저장된 게임 로그 id 를 모르므로, 로그인 회원의 가장 최근 참가 기록 중
 * 이 게임(gameId)이면서 10분 안에 기록된 판을 찾는다. 기록 저장이 몇 초 늦을 수 있어
 * 없으면 404 — 화면이 잠시 뒤 다시 묻고, 끝내 없으면 로비 링크로 공유한다.
 * 본인 참가 행에서 자리(선·후)를 가져오므로 본인 입장의 링크만 만들 수 있다.
 */
export async function POST(request: Request) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const secret = getResultShareSecret();
  if (!secret) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  let gameId: unknown;
  try {
    ({ gameId } = (await request.json()) as { gameId?: unknown });
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (typeof gameId !== 'string' || !/^[a-z0-9-]{1,40}$/.test(gameId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: parts } = await db
    .from('game_log_participants')
    .select('game_log_id, position')
    .eq('member_id', member.id)
    .order('id', { ascending: false })
    .limit(5);
  const rows = (parts ?? []) as { game_log_id: string; position: SharePosition }[];
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: logs } = await db
    .from('game_logs')
    .select('id')
    .in(
      'id',
      rows.map((r) => r.game_log_id),
    )
    .eq('game_id', gameId)
    .gte('created_at', new Date(Date.now() - RECENT_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  const logId = (logs as { id: string }[] | null)?.[0]?.id;
  const row = rows.find((r) => r.game_log_id === logId);
  if (!logId || !row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    path: `/share/result/${createResultShareToken(logId, row.position, secret)}`,
  });
}
