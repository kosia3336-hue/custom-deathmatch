import { getServerSupabase } from '@/lib/supabase/server';
import {
  getRange,
  getTotalPages,
  parsePageParam,
} from '@/lib/pagination';
import type { Json } from '@/lib/supabase/database.types';
import AuditTabClient, { type AuditRow } from './AuditTabClient';
import { ACTION_KINDS } from './auditActions';

interface RawRow {
  id: number;
  actor_id: string | null;
  action_kind: string;
  target_kind: string;
  target_id: string | null;
  payload: Json;
  created_at: string;
}

const TARGET_KIND_LABELS: Record<string, string> = {
  member:       '회원',
  member_title: '회원·칭호',
  title:        '칭호',
  report:       '신고',
  inquiry:      '문의',
  agreement:    '약관',
  word:         '금칙어',
  notice:       '공지',
  member_cdp:   '회원·CDP',
  shop_item:    '상점 아이템',
  shop_purchase:'상점 구매',
};

const PAGE_SIZE = 50; // audit 은 짧은 행 + 시간순 빠른 스캔이라 50 (19_pagination.md §19.8)

export default async function AuditTab({
  page: pageParam,
  actionKind,
  actor,
}: {
  page: string | undefined;
  actionKind?: string;
  actor?: string;
}) {
  const sb = await getServerSupabase();

  // 액션 유형은 코드 상수에서, 처리자는 admin role 회원에서 옵션 구성
  const adminsRes = await sb
    .from('members_private')
    .select('member_id')
    .eq('role', 'admin');
  const adminIds = ((adminsRes.data ?? []) as { member_id: string }[]).map((r) => r.member_id);
  const adminNamesRes = adminIds.length
    ? await sb.from('members').select('id, nickname').in('id', adminIds)
    : { data: [] };
  const adminMap = new Map(
    ((adminNamesRes.data ?? []) as { id: string; nickname: string }[]).map((m) => [
      m.id,
      m.nickname,
    ]),
  );
  const actorOptions = Array.from(adminMap.entries())
    .map(([id, nickname]) => ({ id, nickname }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  const filterActionKind = actionKind && ACTION_KINDS.includes(actionKind) ? actionKind : '';
  const filterActorId = actor && adminMap.has(actor) ? actor : '';

  // 페이지네이션 + 필터 쿼리
  const page = parsePageParam(pageParam);
  const { from, to } = getRange(page, PAGE_SIZE);

  let q = sb
    .from('admin_actions')
    .select('id, actor_id, action_kind, target_kind, target_id, payload, created_at', {
      count: 'exact',
    });
  if (filterActionKind) q = q.eq('action_kind', filterActionKind);
  if (filterActorId) q = q.eq('actor_id', filterActorId);

  const res = await q.order('created_at', { ascending: false }).range(from, to);
  const raw = (res.data ?? []) as unknown as RawRow[];
  const totalCount = res.count ?? 0;
  const totalPages = getTotalPages(totalCount, PAGE_SIZE);

  // UUID / ID 수집
  const memberUUIDs = new Set<string>();
  const titleUUIDs = new Set<string>();
  const reportUUIDs = new Set<string>();
  const inquiryUUIDs = new Set<string>();
  const noticeUUIDs = new Set<string>();
  const shopItemUUIDs = new Set<string>();

  for (const r of raw) {
    if (r.actor_id) memberUUIDs.add(r.actor_id);
    if (r.target_id) {
      if (r.target_kind === 'member' || r.target_kind === 'member_cdp') {
        memberUUIDs.add(r.target_id);
      } else if (r.target_kind === 'member_title') {
        const [mId, tId] = r.target_id.split(':');
        if (mId) memberUUIDs.add(mId);
        if (tId) titleUUIDs.add(tId);
      } else if (r.target_kind === 'title') {
        titleUUIDs.add(r.target_id);
      } else if (r.target_kind === 'report') {
        reportUUIDs.add(r.target_id);
      } else if (r.target_kind === 'inquiry') {
        inquiryUUIDs.add(r.target_id);
      } else if (r.target_kind === 'notice') {
        noticeUUIDs.add(r.target_id);
      } else if (r.target_kind === 'shop_item') {
        shopItemUUIDs.add(r.target_id);
      }
    }
  }

  type ShopItemRow = { id: string; name: string };
  const shopItemsRes =
    shopItemUUIDs.size > 0
      ? await sb.from('shop_items').select('id, name').in('id', [...shopItemUUIDs])
      : { data: [] as ShopItemRow[] };
  const shopItemMap = new Map(
    ((shopItemsRes.data ?? []) as ShopItemRow[]).map((s) => [s.id, s.name]),
  );
  // 삭제 / 미존재시 payload.name fallback
  for (const r of raw) {
    if (r.target_kind === 'shop_item' && r.target_id && !shopItemMap.has(r.target_id)) {
      const p = r.payload as Record<string, unknown> | null;
      const fallback = p?.name ?? (p?.after as Record<string, unknown> | undefined)?.name;
      if (typeof fallback === 'string') shopItemMap.set(r.target_id, fallback);
    }
  }

  // 공지 제목 조회 (삭제된 공지는 없으므로 payload fallback 활용)
  type NoticeRow = { id: string; title: string };
  const noticesRes =
    noticeUUIDs.size > 0
      ? await sb.from('notices').select('id, title').in('id', [...noticeUUIDs])
      : { data: [] as NoticeRow[] };
  const noticeMap = new Map(
    ((noticesRes.data ?? []) as NoticeRow[]).map((n) => [n.id, n.title]),
  );

  // 삭제된 공지는 payload.title 로 보완
  for (const r of raw) {
    if (r.target_kind === 'notice' && r.target_id && !noticeMap.has(r.target_id)) {
      const p = r.payload as Record<string, unknown> | null;
      const fallback = p?.title ?? p?.after;
      if (typeof fallback === 'string') noticeMap.set(r.target_id, fallback);
    }
  }

  // 신고/문의 조회 (병렬)
  type ReportRow = {
    id: string;
    reporter_id: string;
    target_id: string | null;
    reporter_snapshot: Json;
    target_snapshot: Json;
  };
  type InquiryRow = { id: string; author_id: string };

  const [reportsRes, inquiriesRes] = await Promise.all([
    reportUUIDs.size > 0
      ? sb
          .from('reports')
          .select('id, reporter_id, target_id, reporter_snapshot, target_snapshot')
          .in('id', [...reportUUIDs])
      : Promise.resolve({ data: [] as ReportRow[] }),
    inquiryUUIDs.size > 0
      ? sb.from('inquiries').select('id, author_id').in('id', [...inquiryUUIDs])
      : Promise.resolve({ data: [] as InquiryRow[] }),
  ]);

  const reportsData = (reportsRes.data ?? []) as ReportRow[];
  const inquiriesData = (inquiriesRes.data ?? []) as InquiryRow[];

  // 신고/문의에서 추가 member UUID 수집 (스냅샷 없을 때 fallback)
  for (const rep of reportsData) {
    memberUUIDs.add(rep.reporter_id);
    if (rep.target_id) memberUUIDs.add(rep.target_id);
  }
  for (const inq of inquiriesData) {
    memberUUIDs.add(inq.author_id);
  }

  // 회원/칭호 일괄 조회 (병렬)
  const [membersRes, titlesRes] = await Promise.all([
    memberUUIDs.size > 0
      ? sb.from('members').select('id, nickname').in('id', [...memberUUIDs])
      : Promise.resolve({ data: [] }),
    titleUUIDs.size > 0
      ? sb.from('titles').select('id, name').in('id', [...titleUUIDs])
      : Promise.resolve({ data: [] }),
  ]);

  const memberMap = new Map(
    ((membersRes.data ?? []) as { id: string; nickname: string }[]).map((m) => [m.id, m.nickname]),
  );
  const titleMap = new Map(
    ((titlesRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
  );

  // 신고 참여자 맵
  type ReportParticipants = { reporter: string; reported: string };
  const reportMap = new Map<string, ReportParticipants>();
  for (const rep of reportsData) {
    const rSnap = rep.reporter_snapshot as { nickname?: string } | null;
    const tSnap = rep.target_snapshot as { nickname?: string } | null;
    reportMap.set(rep.id, {
      reporter: rSnap?.nickname ?? memberMap.get(rep.reporter_id) ?? '(탈퇴)',
      reported:
        tSnap?.nickname ??
        (rep.target_id ? (memberMap.get(rep.target_id) ?? '(탈퇴)') : '(탈퇴)'),
    });
  }

  // 문의 작성자 맵
  const inquiryAuthorMap = new Map<string, string>();
  for (const inq of inquiriesData) {
    inquiryAuthorMap.set(inq.id, memberMap.get(inq.author_id) ?? '(탈퇴)');
  }

  function resolveTarget(kind: string, id: string | null): { label: string; sub?: string[] } {
    if (!id) return { label: '-' };
    switch (kind) {
      case 'member':
        return { label: memberMap.get(id) ?? '(탈퇴)' };
      case 'member_title': {
        const [mId, tId] = id.split(':');
        const mName = memberMap.get(mId ?? '') ?? '(탈퇴)';
        const tName = titleMap.get(tId ?? '') ?? '(삭제)';
        return { label: `${mName} / ${tName}` };
      }
      case 'title':
        return { label: titleMap.get(id) ?? '(삭제)' };
      case 'report': {
        const p = reportMap.get(id);
        if (!p) return { label: `#${id.slice(0, 8)}` };
        return { label: `신고자: ${p.reporter}`, sub: [`피신고: ${p.reported}`] };
      }
      case 'inquiry':
        if (!/^[0-9a-fA-F]{8}-/.test(id)) return { label: `분류 ${id}` };
        return { label: `문의자: ${inquiryAuthorMap.get(id) ?? `#${id.slice(0, 8)}`}` };
      case 'agreement':
        return { label: `약관 #${id.slice(0, 8)}` };
      case 'word':
        return { label: id };
      case 'notice':
        return { label: noticeMap.get(id) ?? `#${id.slice(0, 8)}` };
      case 'member_cdp':
        return { label: memberMap.get(id) ?? '(탈퇴)' };
      case 'shop_item':
        return { label: shopItemMap.get(id) ?? `#${id.slice(0, 8)}` };
      case 'shop_purchase':
        return { label: `#${id.slice(0, 8)}` };
      default:
        return { label: id };
    }
  }

  const rows: AuditRow[] = raw.map((r) => {
    const target = resolveTarget(r.target_kind, r.target_id);
    return {
      id: r.id,
      actor_nickname: r.actor_id
        ? (memberMap.get(r.actor_id) ?? r.actor_id.slice(0, 8))
        : 'SYSTEM',
      action_kind: r.action_kind,
      target_kind_label: TARGET_KIND_LABELS[r.target_kind] ?? r.target_kind,
      target_label: target.label,
      sub_labels: target.sub,
      payload: r.payload,
      created_at: r.created_at,
    };
  });

  return (
    <AuditTabClient
      rows={rows}
      currentPage={page}
      totalPages={totalPages}
      totalCount={totalCount}
      filterActionKind={filterActionKind}
      filterActorId={filterActorId}
      actorOptions={actorOptions}
    />
  );
}
