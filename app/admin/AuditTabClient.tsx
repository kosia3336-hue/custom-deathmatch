'use client';

import { useState, useMemo } from 'react';
import type { Json } from '@/lib/supabase/database.types';

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

const ACTION_LABELS: Record<string, { label: string; variant: string }> = {
  'member.suspend':        { label: '일시정지',     variant: 'warning' },
  'member.ban':            { label: '영구정지',     variant: 'danger'  },
  'member.lift':           { label: '제재 해제',    variant: 'success' },
  'member.set_role':       { label: '역할 변경',    variant: 'default' },
  'member.nickname_reset': { label: '닉네임 초기화', variant: 'default' },
  'title.create':          { label: '칭호 생성',    variant: 'accent'  },
  'title.update':          { label: '칭호 편집',    variant: 'accent'  },
  'title.grant':           { label: '칭호 부여',    variant: 'accent'  },
  'title.revoke':          { label: '칭호 압수',    variant: 'danger'  },
  'report.resolve':        { label: '신고 처리',    variant: 'default' },
  'report.reject':         { label: '신고 반려',    variant: 'default' },
  'inquiry.answer':        { label: '문의 답변',    variant: 'default' },
  'inquiry.close':         { label: '문의 종결',    variant: 'default' },
  'agreement.publish':     { label: '약관 게시',    variant: 'default' },
  'word.add':              { label: '금칙어 추가',   variant: 'default' },
  'word.delete':           { label: '금칙어 삭제',   variant: 'default' },
};

const BADGE_CLASSES: Record<string, string> = {
  default: 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
  danger:  'bg-red-500/15 text-red-500',
  warning: 'bg-orange-500/15 text-orange-500',
  success: 'bg-green-500/15 text-green-500',
  accent:  'bg-cdm-primary/15 text-cdm-primary',
};

const PAYLOAD_KEY_LABELS: Record<string, string> = {
  reason:     '사유',
  resolution: '처리 결과',
  role:       '역할',
  until:      '정지 만료',
  name:       '이름',
  color:      '색상',
};

const HIDDEN_PAYLOAD_KEYS = new Set(['report_id', 'len', 'title_id']);

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

function PayloadList({ payload }: { payload: Json }) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const entries = Object.entries(payload as Record<string, unknown>).filter(
    ([k, v]) => !HIDDEN_PAYLOAD_KEYS.has(k) && v !== null && v !== undefined && v !== '',
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(([k, v]) => {
        const rendered = renderPayloadValue(k, v);
        if (!rendered) return null;
        return (
          <span key={k} className="text-[11px] text-cdm-fg-muted leading-relaxed">
            <span className="font-medium text-cdm-fg-subtle">
              {PAYLOAD_KEY_LABELS[k] ?? k}:
            </span>{' '}
            {rendered}
          </span>
        );
      })}
    </div>
  );
}

export default function AuditTabClient({ rows }: { rows: AuditRow[] }) {
  const [filterKind, setFilterKind] = useState('');
  const [filterActor, setFilterActor] = useState('');

  const allKinds = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action_kind))).sort(),
    [rows],
  );
  const allActors = useMemo(
    () => Array.from(new Set(rows.map((r) => r.actor_nickname))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    let out = rows;
    if (filterKind) out = out.filter((r) => r.action_kind === filterKind);
    if (filterActor) out = out.filter((r) => r.actor_nickname === filterActor);
    return out;
  }, [rows, filterKind, filterActor]);

  const hasFilter = filterKind || filterActor;

  if (rows.length === 0) {
    return <p className="text-sm text-cdm-fg-subtle">관리자 로그가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-2.5 py-1.5 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
        >
          <option value="">액션 유형 전체 ({rows.length}건)</option>
          {allKinds.map((k) => (
            <option key={k} value={k}>
              {ACTION_LABELS[k]?.label ?? k} ({rows.filter((r) => r.action_kind === k).length}건)
            </option>
          ))}
        </select>

        <select
          value={filterActor}
          onChange={(e) => setFilterActor(e.target.value)}
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-2.5 py-1.5 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
        >
          <option value="">처리자 전체</option>
          {allActors.map((a) => (
            <option key={a} value={a}>
              {a} ({rows.filter((r) => r.actor_nickname === a).length}건)
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={() => { setFilterKind(''); setFilterActor(''); }}
            className="text-xs text-cdm-fg-muted underline underline-offset-2 hover:text-cdm-fg"
          >
            초기화
          </button>
        )}

        <span className="ml-auto text-xs text-cdm-fg-muted">
          {filtered.length}건
        </span>
      </div>

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
            {filtered.map((r, i) => {
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
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-cdm-fg-subtle">해당 항목이 없습니다.</p>
        )}
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-cdm-fg-subtle">해당 항목이 없습니다.</p>
        ) : (
          filtered.map((r) => {
            const { date, time } = formatDateTime(r.created_at);
            return (
              <div
                key={r.id}
                className="rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 px-3.5 py-3 flex flex-col gap-1.5"
              >
                {/* 1행: 액션 배지 + 처리자·시간 */}
                <div className="flex items-center justify-between gap-2">
                  <ActionBadge kind={r.action_kind} />
                  <span className="text-[11px] text-cdm-fg-muted whitespace-nowrap">
                    {r.actor_nickname} · {date} {time}
                  </span>
                </div>
                {/* 2행: 대상 */}
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
                {/* 3행~: payload */}
                <PayloadList payload={r.payload} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
