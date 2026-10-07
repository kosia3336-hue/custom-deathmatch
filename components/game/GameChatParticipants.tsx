'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SkinTheme } from '@/lib/skins/registry';
import { gamePanelSkinClass } from './GamePanelSkin';
import { Icon } from '@/components/cdm';
import { ReportModal } from '@/components/cdm/ReportModal';
import RoomParticipants, { type ParticipantReportTarget } from '@/components/room/RoomParticipants';
import type { Room } from '@/shared/types';
import styles from './game-chat.module.css';

/** 채팅 헤더에서 아래로 펼쳐지는 참여자 정보. 도킹 위치와 무관하게 헤더에 붙는다. */
export default function GameChatParticipants({
  room,
  myId,
  spectatorCount,
  active = true,
  skin,
}: {
  room: Room | null | undefined;
  myId: string | null | undefined;
  spectatorCount: number;
  active?: boolean;
  skin?: SkinTheme | null;
}) {
  const [open, setOpen] = useState(false);
  if (open && !active) setOpen(false);
  const [report, setReport] = useState<ParticipantReportTarget | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 0 });

  useEffect(() => {
    if (!open) return;
    const header = button.current?.closest('[data-panel-header]');
    if (!header) return;
    const place = () => {
      const rect = header.getBoundingClientRect();
      const width = Math.min(380, window.innerWidth - 16);
      const top = rect.bottom + 4;
      setPosition({
        top,
        left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
        width,
        maxHeight: Math.max(0, window.innerHeight - top - 8),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(header);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const trigger = button.current;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const nodes = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey, true);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="전체 참여자 정보"
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className="rounded-cdm-md text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg focus-visible:outline-cdm-primary ml-2 shrink-0 px-2 py-1.5 text-xs transition-colors"
      >
        관전 {spectatorCount}명
      </button>
      {open &&
        createPortal(
          <div
            className={styles.overlay}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div aria-hidden className={styles.backdrop} onClick={() => setOpen(false)} />
            <div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              className={`${styles.participants} ${gamePanelSkinClass(skin, true) ?? ''}`}
              style={position}
            >
              <div
                data-panel-header
                className="border-cdm-border flex shrink-0 items-center justify-between border-b px-4 py-2.5"
              >
                <h2 id={headingId} className="text-sm font-bold">
                  참여자 정보
                </h2>
                <button
                  type="button"
                  aria-label="참여자 정보 닫기"
                  onClick={() => setOpen(false)}
                  className="rounded-cdm-md text-cdm-fg-muted hover:bg-cdm-bg-elev-1 p-1.5"
                >
                  <Icon name="close" size="sm" />
                </button>
              </div>
              <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
                <RoomParticipants
                  room={room}
                  myId={myId}
                  onReport={(target) => {
                    setOpen(false);
                    setReport(target);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
      <ReportModal
        open={!!report}
        onClose={() => setReport(null)}
        targetId={report?.memberId ?? null}
        targetNickname={report?.nickname}
        context="ingame"
        contextData={{ roomId: room?.id }}
      />
    </>
  );
}
