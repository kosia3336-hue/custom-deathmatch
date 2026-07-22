'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/cdm/Modal';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { Spinner } from '@/components/cdm/Spinner';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { TitleColor } from '@/lib/supabase/database.types';

interface Holder {
  member_id: string;
  nickname: string;
  granted_at: string;
}

interface TitleDetailModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string | null;
  titleName: string;
  titleColor: TitleColor;
  titleEffect?: string | null;
  description: string | null;
  conditionText: string | null;
  isSystem: boolean;
  holderCount: number;
}

function formatKstDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TitleDetailModal({
  open,
  onClose,
  titleId,
  titleName,
  titleColor,
  titleEffect,
  description,
  conditionText,
  isSystem,
  holderCount,
}: TitleDetailModalProps) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !titleId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const sb = getBrowserSupabase();
        const data = await callRpc(sb, 'get_public_title_holders', {
          p_title_id: titleId,
        });
        if (cancelled) return;
        setHolders((data ?? []) as unknown as Holder[]);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, titleId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <TitleBadge name={titleName} color={titleColor} effect={titleEffect as TitleEffect | null} size="md" />
          {isSystem && (
            <span
              className="inline-flex items-center rounded-full border border-cdm-border px-2 py-px text-[10px] font-semibold text-cdm-fg-muted"
              title="히든 시스템 칭호"
            >
              히든
            </span>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {description && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-cdm-fg-subtle">
              설명
            </h3>
            <p className="text-sm text-cdm-fg">{description}</p>
          </div>
        )}

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-cdm-fg-subtle">
            달성 조건
          </h3>
          {conditionText ? (
            <p className="text-sm text-cdm-fg">{conditionText}</p>
          ) : (
            <p className="text-sm text-cdm-fg-muted italic">
              조건이 공개되어 있지 않은 칭호예요.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-cdm-fg-subtle">
            보유자 {holderCount > 0 ? `(${holderCount}명)` : ''}
          </h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-cdm-fg-muted">
              <Spinner size={16} /> 불러오는 중…
            </div>
          ) : error ? (
            <p className="text-sm text-cdm-accent">보유자 조회 실패: {error}</p>
          ) : holders.length === 0 ? (
            <p className="text-sm text-cdm-fg-muted">아직 보유자가 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 max-h-[min(50vh,320px)] overflow-y-auto pr-1">
              {holders.map((h) => (
                <li
                  key={h.member_id}
                  className="flex items-center justify-between gap-3 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2"
                >
                  <span className="truncate text-sm font-medium text-cdm-fg">
                    {h.nickname}
                  </span>
                  <time
                    dateTime={h.granted_at}
                    className="shrink-0 text-xs text-cdm-fg-subtle tabular-nums"
                  >
                    {formatKstDate(h.granted_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
