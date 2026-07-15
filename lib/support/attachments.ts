import 'server-only';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

/** 문의/신고 첨부 URL 맵 조회 — {targetId: url[]} */
export async function fetchAttachments(
  targetKind: 'inquiry' | 'report',
  targetIds: string[],
): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  if (targetIds.length === 0 || !isSupabaseServiceRoleConfigured()) return map;
  try {
    const sb = getSupabaseServiceRole();
    const { data } = await sb
      .from('attach_files')
      .select('target_id, url')
      .eq('target_kind', targetKind)
      .in('target_id', targetIds)
      .order('created_at', { ascending: true });
    for (const r of (data ?? []) as { target_id: string; url: string }[]) {
      (map[r.target_id] ??= []).push(r.url);
    }
  } catch {
    // 테이블 미생성 등 — 빈 맵
  }
  return map;
}
