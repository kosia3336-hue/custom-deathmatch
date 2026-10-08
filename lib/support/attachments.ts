import 'server-only';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const ATTACHMENTS_BUCKET = 'attachments';

/**
 * attach_files.url 에서 버킷 안 경로를 꺼낸다.
 *
 * 예전에는 버킷이 public 이라 getPublicUrl 주소를 그대로 저장하고 보여 줬다.
 * 버킷을 비공개로 바꾸면 그 주소로는 열리지 않으므로, 저장된 주소에서 경로만
 * 뽑아 볼 때마다 서명 URL 을 만든다(저장 형식은 그대로 둔다).
 */
export function attachmentPathFromUrl(url: string): string | null {
  const markers = [
    `/storage/v1/object/public/${ATTACHMENTS_BUCKET}/`,
    `/storage/v1/object/sign/${ATTACHMENTS_BUCKET}/`,
  ];
  for (const m of markers) {
    const at = url.indexOf(m);
    if (at < 0) continue;
    const rest = url.slice(at + m.length).split('?')[0];
    try {
      return decodeURIComponent(rest);
    } catch {
      return null;
    }
  }
  return null;
}

/** 경로 → 서명 URL. 실패한 항목은 결과에 넣지 않는다. */
export async function signAttachmentPaths(
  paths: string[],
  expiresInSeconds: number,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0 || !isSupabaseServiceRoleConfigured()) return out;
  const { data } = await getSupabaseServiceRole()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl);
  }
  return out;
}

/** 관리자 화면에서 보는 동안 열려 있으면 되므로 1시간 */
const VIEW_TTL_SECONDS = 60 * 60;

/** 문의/신고 첨부 URL 맵 조회 — {targetId: 서명 url[]} */
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
    const rows = (data ?? []) as { target_id: string; url: string }[];

    const paths = rows
      .map((r) => attachmentPathFromUrl(r.url))
      .filter((p): p is string => !!p);
    const signed = await signAttachmentPaths([...new Set(paths)], VIEW_TTL_SECONDS);

    for (const r of rows) {
      const path = attachmentPathFromUrl(r.url);
      // 경로를 못 뽑으면(예전 형식 등) 저장된 주소를 그대로 둔다
      const shown = (path && signed.get(path)) || r.url;
      (map[r.target_id] ??= []).push(shown);
    }
  } catch {
    // 테이블 미생성 등 — 빈 맵
  }
  return map;
}
