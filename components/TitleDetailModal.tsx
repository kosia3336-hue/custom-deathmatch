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
  onClose?: () => void;
  titleId: string | null;
  titleName: string;
  titleColor: TitleColor;
  titleEffect?: string | null;
  description: string | null;
  conditionText: string | null;
  isSystem: boolean;
  holderCount: number;
  /** 오버레이 없이 패널만 렌더 (소개 미리보기) */
  embedded?: boolean;
  /** 있으면 보유자를 다시 조회하지 않는다 */
  initialHolders?: Holder[];
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
  embedded = false,
  initialHolders,
}: TitleDetailModalProps) {
  const presetHolders = initialHolders !== undefined;
  const [holders, setHolders] = useState<Holder[]>(initialHolders ?? []);
  const [loading, setLoading] = useState(!presetHolders && open && Boolean(titleId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presetHolders) {
      setHolders(initialHolders ?? []);
      setLoading(false);
      setError(null);
      return;
    }
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
  }, [open, titleId, presetHolders, initialHolders]);

  return (
    <Modal
      open={open}
      onClose={embedded ? undefined : onClose}
      inline={embedded}
      showClose={embedded}
      closeOnEscape={!embedded}
      closeOnBackdrop={!embedded}
      mobileBottomSheet={!embedded}
      size="md"
      className={embedded ? 'intro-title-modal' : undefined}
      title={
        <span className="flex items-center gap-2">
          <TitleBadge
            name={titleName}
            color={titleColor}
            effect={titleEffect as TitleEffect | null}
            size={embedded ? 'sm' : 'md'}
          />
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
      <div className={embedded ? 'flex flex-col gap-2' : 'flex flex-col gap-4'}>
        {description && (
          <div>
            <h3 className={`font-semibold uppercase tracking-wider text-cdm-fg-subtle ${embedded ? 'mb-0.5 text-[10px]' : 'mb-1 text-xs'}`}>
              설명
            </h3>
            <p className={embedded ? 'text-xs text-cdm-fg' : 'text-sm text-cdm-fg'}>{description}</p>
          </div>
        )}

        <div>
          <h3 className={`font-semibold uppercase tracking-wider text-cdm-fg-subtle ${embedded ? 'mb-0.5 text-[10px]' : 'mb-1 text-xs'}`}>
            달성 조건
          </h3>
          {conditionText ? (
            <p className={embedded ? 'text-xs text-cdm-fg' : 'text-sm text-cdm-fg'}>{conditionText}</p>
          ) : (
            <p className={embedded ? 'text-xs text-cdm-fg-muted italic' : 'text-sm text-cdm-fg-muted italic'}>
              조건이 공개되어 있지 않은 칭호입니다.
            </p>
          )}
        </div>

        <div>
          <h3 className={`font-semibold uppercase tracking-wider text-cdm-fg-subtle ${embedded ? 'mb-1 text-[10px]' : 'mb-2 text-xs'}`}>
            보유자 {holderCount > 0 ? `(${holderCount}명)` : ''}
          </h3>
          {loading ? (
            <div className={`flex items-center gap-2 text-cdm-fg-muted ${embedded ? 'text-xs' : 'text-sm'}`}>
              <Spinner size={16} /> 불러오는 중…
            </div>
          ) : error ? (
            <p className={embedded ? 'text-xs text-cdm-accent' : 'text-sm text-cdm-accent'}>보유자 조회 실패: {error}</p>
          ) : holders.length === 0 ? (
            <p className={embedded ? 'text-xs text-cdm-fg-muted' : 'text-sm text-cdm-fg-muted'}>아직 보유자가 없습니다.</p>
          ) : (
            <ul className={`flex flex-col overflow-y-auto pr-1 ${embedded ? 'max-h-[4.5rem] gap-1' : 'max-h-[min(50vh,320px)] gap-1.5'}`}>
              {holders.map((h) => (
                <li
                  key={h.member_id}
                  className={`flex items-center justify-between rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 ${embedded ? 'gap-2 px-2 py-1' : 'gap-3 px-3 py-2'}`}
                >
                  <span className={`truncate font-medium text-cdm-fg ${embedded ? 'text-xs' : 'text-sm'}`}>
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
