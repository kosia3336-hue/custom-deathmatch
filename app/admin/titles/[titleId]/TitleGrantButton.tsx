'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { TitleColor } from '@/lib/supabase/database.types';

interface MemberResult {
  id: string;
  nickname: string;
}

interface Props {
  titleId: string;
  titleName: string;
  titleColor: TitleColor;
  titleDescription: string | null;
  activeOwnerIds: string[];
}

export default function TitleGrantButton({
  titleId,
  titleName,
  titleColor,
  titleDescription,
  activeOwnerIds,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberResult[]>([]);
  const [selected, setSelected] = useState<MemberResult | null>(null);
  const [reason, setReason] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setReason('');
    }
  }, [open]);

  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const sb = getBrowserSupabase();
        const { data } = await sb
          .from('members')
          .select('id, nickname')
          .ilike('nickname', `%${query.trim()}%`)
          .is('withdrawn_at', null)
          .limit(8);
        setResults((data ?? []) as MemberResult[]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query, selected]);

  function selectMember(m: MemberResult) {
    setSelected(m);
    setQuery(m.nickname);
    setResults([]);
  }

  function clearSelection() {
    setSelected(null);
    setQuery('');
    setResults([]);
  }

  function go() {
    if (!selected) {
      toast.error('회원을 선택해주세요');
      return;
    }
    if (!reason.trim()) {
      toast.error('사유를 입력해주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_grant_title', {
          p_member_id: selected.id,
          p_title_id: titleId,
          p_reason: reason.trim(),
        });
        toast.success(`${selected.nickname}에게 "${titleName}" 부여 완료`);

        fetch('/api/admin/notify-title-granted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: selected.id,
            titleId,
            name: titleName,
            color: titleColor,
            description: titleDescription,
          }),
        }).catch(() => {});

        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  const alreadyOwned = selected ? activeOwnerIds.includes(selected.id) : false;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + 부여
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`"${titleName}" 부여`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              취소
            </Button>
            <Button onClick={go} loading={busy}>
              부여
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {/* 칭호 미리보기 */}
          <div className="flex items-center gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2.5">
            <TitleBadge name={titleName} color={titleColor} size="sm" />
            {titleDescription && (
              <span className="text-xs text-cdm-fg-muted">{titleDescription}</span>
            )}
          </div>

          {/* 회원 검색 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cdm-fg">회원 *</label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selected) clearSelection();
                }}
                placeholder="닉네임으로 검색"
                className="w-full rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
              />
              {selected && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cdm-fg-muted hover:text-cdm-fg"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 검색 결과 드롭다운 */}
            {!selected && results.length > 0 && (
              <div className="rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 shadow-sm">
                {results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMember(m)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-cdm-fg hover:bg-cdm-bg-elev-2"
                  >
                    <span>{m.nickname}</span>
                    {activeOwnerIds.includes(m.id) && (
                      <span className="text-[11px] text-cdm-fg-subtle">이미 보유</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {!selected && searching && (
              <p className="text-xs text-cdm-fg-subtle">검색 중...</p>
            )}
            {!selected && !searching && query.trim() && results.length === 0 && (
              <p className="text-xs text-cdm-fg-subtle">검색 결과가 없습니다.</p>
            )}

            {alreadyOwned && (
              <p className="text-xs text-cdm-fg-muted">
                이미 보유 중입니다. 부여 시 사유가 업데이트됩니다.
              </p>
            )}
          </div>

          {/* 사유 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cdm-fg">사유 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="부여 사유를 입력하세요"
              className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
