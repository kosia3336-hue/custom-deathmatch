/**
 * 칭호 획득 pending notification 조회 헬퍼.
 *
 * 사용자가 미접속 상태에서 칭호를 받은 경우, 다음 접속 시
 * 이 함수로 Supabase notifications 테이블에서 읽어 모달을 띄운다.
 * 읽은 항목은 is_read = true 로 마킹한다.
 */

import { getSupabaseAdmin } from './supabase.js';
import type { PendingTitlePayload } from '../store/sessions.js';

interface NotifRow {
  id: number;
  body: string;
}

interface TitleRow {
  id: string;
  name: string;
  color: string;
  description: string | null;
}

export async function fetchAndMarkPendingTitles(memberId: string): Promise<PendingTitlePayload[]> {
  const sb = getSupabaseAdmin();

  const { data: notifs } = await sb
    .from('notifications')
    .select('id, body')
    .eq('member_id', memberId)
    .eq('kind', 'title_granted')
    .eq('is_read', false)
    .order('created_at', { ascending: true });

  if (!notifs || notifs.length === 0) return [];

  const rows = notifs as NotifRow[];
  const results: PendingTitlePayload[] = [];
  const readIds: number[] = [];

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.body) as { title_id?: string };
      if (!parsed.title_id) continue;

      const { data: title } = await sb
        .from('titles')
        .select('id, name, color, description')
        .eq('id', parsed.title_id)
        .maybeSingle();

      if (!title) continue;
      const t = title as TitleRow;

      results.push({
        titleId: t.id,
        name: t.name,
        color: t.color,
        description: t.description,
      });
      readIds.push(row.id);
    } catch {
      // body 파싱 실패: 구버전 plain-text 알림은 skip
    }
  }

  if (readIds.length > 0) {
    await sb.from('notifications').update({ is_read: true }).in('id', readIds);
  }

  return results;
}

/** 특정 멤버의 title_granted 알림 전체를 읽음 처리 (온라인 직접 emit 후 호출) */
export async function markAllTitleNotifsRead(memberId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb
    .from('notifications')
    .update({ is_read: true })
    .eq('member_id', memberId)
    .eq('kind', 'title_granted')
    .eq('is_read', false);
}
