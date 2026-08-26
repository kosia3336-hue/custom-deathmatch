'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/cdm/Pagination';
import { usePagination } from '@/hooks/usePagination';
import type { Json } from '@/lib/supabase/database.types';
import { ACTION_KINDS, ACTION_LABELS } from './auditActions';

export interface AuditRow {
  id: number;
  actor_nickname: string;
  action_kind: string;
  target_kind_label: string;
  target_label: string;
  sub_labels?: string[];
  payload: Json;
  created_at: string;
}


const BADGE_CLASSES: Record<string, string> = {
  default: 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
  danger:  'bg-red-500/15 text-red-500',
  warning: 'bg-orange-500/15 text-orange-500',
  success: 'bg-green-500/15 text-green-500',
  accent:  'bg-cdm-primary/15 text-cdm-primary',
};

const PAYLOAD_KEY_LABELS: Record<string, string> = {
  reason:       '사유',
  resolution:   '처리 결과',
  role:         '역할',
  until:        '정지 만료',
  name:         '이름',
  color:        '색상',
  // 공지 관련 (v2.7)
  title:        '제목',
  category:     '카테고리',
  is_pinned:    '상단 고정',
  is_published: '공개',
  pinned:       '고정',
  published:    '공개',
  body_len:     '본문 길이',
  // 상점 / CDP
  requested_delta: '요청 변경량',
  applied_delta:   '적용 변경량',
  clamped:         '0 보정',
  before:          '변경 전',
  after:           '변경 후',
  price:           '가격',
  stock:           '재고',
  type:            '유형',
  active:          '노출',
  guildId:         '길드',
  logoId:          '마크',
  markUrl:         '마크 주소',
  capacity:        '정원',
  memberCount:     '인원',
  memberIds:       '길드원',
  promote:         '임명',
  approve:         '승인',
  requestId:       '신청',
  description:     '소개',
};

const HIDDEN_PAYLOAD_KEYS = new Set(['report_id', 'len', 'title_id', 'body']);

const RESOLUTION_KO: Record<string, string> = {
  warning:   '경고',
  suspended: '일시정지',
  banned:    '영구정지',
  rejected:  '반려',
};

const ROLE_KO: Record<string, string> = {
  admin: '관리자',
  user:  '일반',
};

const NOTICE_CATEGORY_KO: Record<string, string> = {
  general:     '일반',
  maintenance: '점검',
  update:      '업데이트',
  event:       '이벤트',
  urgent:      '긴급',
};

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const date = `${yy}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

function renderPayloadValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (key === 'resolution') return RESOLUTION_KO[String(value)] ?? String(value);
  if (key === 'role') return ROLE_KO[String(value)] ?? String(value);
  if (key === 'category') return NOTICE_CATEGORY_KO[String(value)] ?? String(value);
  if (key === 'until') {
    const d = new Date(String(value));
    const pad = (n: number) => String(n).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    return `${yy}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return String(value);
}

function ActionBadge({ kind }: { kind: string }) {
  const info = ACTION_LABELS[kind] ?? { label: '(알 수 없음)', variant: 'default' };
  return (
    <span
      className={`inline-block rounded-cdm-sm px-1.5 py-0.5 text-[11px] font-semibold ${BADGE_CLASSES[info.variant] ?? BADGE_CLASSES.default}`}
    >
      {info.label}
    </span>
  );
}

function PayloadEntry({ k, v }: { k: string; v: unknown }) {
  // before/after 중첩 객체 → "변경 전 제목: …" 형태로 평탄화
  if ((k === 'before' || k === 'after') && v && typeof v === 'object' && !Array.isArray(v)) {
    const prefix = k === 'before' ? '변경 전' : '변경 후';
    return (
      <>
        {Object.entries(v as Record<string, unknown>)
          .filter(([ik, iv]) => !HIDDEN_PAYLOAD_KEYS.has(ik) && iv !== null && iv !== undefined && iv !== '')
          .map(([ik, iv]) => {
            const rendered = renderPayloadValue(ik, iv);
            if (!rendered) return null;
            const innerLabel = PAYLOAD_KEY_LABELS[ik] ?? ik;
            return (
              <span key={`${k}-${ik}`} className="text-[11px] text-cdm-fg-muted leading-relaxed">
                <span className="font-medium text-cdm-fg-subtle">{prefix} {innerLabel}:</span>{' '}
                {rendered}
              </span>
            );
          })}
      </>
    );
  }
  const rendered = renderPayloadValue(k, v);
  if (!rendered) return null;
  return (
    <span className="text-[11px] text-cdm-fg-muted leading-relaxed">
      <span className="font-medium text-cdm-fg-subtle">
        {PAYLOAD_KEY_LABELS[k] ?? k}:
      </span>{' '}
      {rendered}
    </span>
  );
}

function PayloadList({ payload }: { payload: Json }) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const entries = Object.entries(payload as Record<string, unknown>).filter(
    ([k, v]) => !HIDDEN_PAYLOAD_KEYS.has(k) && v !== null && v !== undefined && v !== '',
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(([k, v]) => (
        <PayloadEntry key={k} k={k} v={v} />
      ))}
    </div>
  );
}

interface ActorOption {
  id: string;
  nickname: string;
}

interface Props {
  rows: AuditRow[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  filterActionKind: string;
  filterActorId: string;
  actorOptions: ActorOption[];
}

export default function AuditTabClient({
  rows,
  currentPage,
  totalPages,
  totalCount,
  filterActionKind,
  filterActorId,
  actorOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setPage } = usePagination();

  const replaceFilter = useCallback(
    (key: 'actionKind' | 'actor', value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      // 필터 변경 시 page 자동 리셋 (1페이지)
      next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const resetFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('actionKind');
    next.delete('actor');
    next.delete('page');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const hasFilter = !!filterActionKind || !!filterActorId;

  if (totalCount === 0 && !hasFilter) {
    return <p className="text-sm text-cdm-fg-subtle">관리자 로그가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterActionKind}
          onChange={(e) => replaceFilter('actionKind', e.target.value)}
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-2.5 py-1.5 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
        >
          <option value="">액션 유형 전체</option>
          {ACTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {ACTION_LABELS[k]?.label ?? k}
            </option>
          ))}
        </select>

        <select
          value={filterActorId}
          onChange={(e) => replaceFilter('actor', e.target.value)}
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-2.5 py-1.5 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
        >
          <option value="">처리자 전체</option>
          {actorOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nickname}
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={resetFilters}
            className="text-xs text-cdm-fg-muted underline underline-offset-2 hover:text-cdm-fg"
          >
            초기화
          </button>
        )}

        <span className="ml-auto text-xs text-cdm-fg-muted">
          {totalCount}건 · {currentPage} / {totalPages} 페이지
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-cdm-fg-subtle">해당 항목이 없습니다.</p>
      ) : (
        <>
          {/* 데스크톱 표 */}
          <div className="hidden md:block overflow-x-auto rounded-cdm-lg border border-cdm-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cdm-border bg-cdm-bg-elev-1 text-left text-xs font-semibold text-cdm-fg-muted">
                  <th className="px-3 py-2 whitespace-nowrap" style={{ minWidth: 80 }}>시간</th>
                  <th className="px-3 py-2 whitespace-nowrap" style={{ minWidth: 80 }}>처리자</th>
                  <th className="px-3 py-2 whitespace-nowrap" style={{ minWidth: 100 }}>액션</th>
                  <th className="px-3 py-2 whitespace-nowrap" style={{ minWidth: 140 }}>대상</th>
                  <th className="px-3 py-2">내용</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const { date, time } = formatDateTime(r.created_at);
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-cdm-border last:border-0 ${i % 2 === 1 ? 'bg-cdm-bg-elev-1/40' : ''}`}
                    >
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="flex flex-col text-[11px] text-cdm-fg-muted leading-relaxed">
                          <span>{date}</span>
                          <span>{time}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span className="text-xs font-medium text-cdm-fg">{r.actor_nickname}</span>
                      </td>
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <ActionBadge kind={r.action_kind} />
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-medium text-cdm-fg-muted">
                            {r.target_kind_label}
                          </span>
                          {r.target_label && r.target_label !== '-' && (
                            <span className="text-[11px] text-cdm-fg">
                              {r.target_label}
                            </span>
                          )}
                          {r.sub_labels?.map((s, i) => (
                            <span key={i} className="text-[11px] text-cdm-fg">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <PayloadList payload={r.payload} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="md:hidden flex flex-col gap-2">
            {rows.map((r) => {
              const { date, time } = formatDateTime(r.created_at);
              return (
                <div
                  key={r.id}
                  className="rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 px-3.5 py-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <ActionBadge kind={r.action_kind} />
                    <span className="text-[11px] text-cdm-fg-muted whitespace-nowrap">
                      {r.actor_nickname} · {date} {time}
                    </span>
                  </div>
                  {r.target_label && r.target_label !== '-' && (
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[11px] text-cdm-fg">
                        <span className="font-medium text-cdm-fg-muted">{r.target_kind_label}: </span>
                        {r.target_label}
                      </p>
                      {r.sub_labels?.map((s, i) => (
                        <p key={i} className="text-[11px] text-cdm-fg">
                          {s}
                        </p>
                      ))}
                    </div>
                  )}
                  <PayloadList payload={r.payload} />
                </div>
              );
            })}
          </div>
        </>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
