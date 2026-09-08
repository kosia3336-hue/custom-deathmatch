'use client';

import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { GameTimeExpiry } from '@/shared/types/events';
import { useEffect, useRef } from 'react';

export function TimeExpiryModal({
  expiry,
  myId,
  onDecision,
}: {
  expiry: GameTimeExpiry | null;
  myId: string;
  onDecision: (decision: 'continue' | 'finish') => void;
}) {
  const canDecide = expiry?.deciderId === myId;
  const com = expiry?.mode === 'com';
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expiry) return;
    const previous = document.activeElement;
    // 애니메이션이 포함된 모달의 DOM이 생성된 다음 포커스를 옮긴다.
    const frame = requestAnimationFrame(() => {
      (dialog.current?.querySelector('button') ?? dialog.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [expiry]);
  return (
    <div className="relative z-[120]">
      <Modal open={expiry !== null} closable={false} title="착수 시간 초과">
        <div
          ref={dialog}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="착수 시간 초과"
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            const buttons = dialog.current?.querySelectorAll('button');
            if (!buttons?.length) {
              event.preventDefault();
              return;
            }
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first || document.activeElement === dialog.current)
            ) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }}
        >
          <p className="text-cdm-fg text-sm leading-relaxed">
            {canDecide
              ? com
                ? '착수 시간이 초과되어 패배하는 상황입니다. COM 대전에서는 원한다면 게임을 이어갈 수 있습니다.'
                : '상대의 착수 시간이 초과되어 몰수패되는 상황입니다. 그러나 당신이 원한다면 게임을 이어갈 수 있습니다.'
              : expiry?.loserId === myId
                ? '착수 시간이 초과되었습니다. 상대가 게임을 이어갈지, 승리로 종료할지 선택하고 있습니다.'
                : '착수 시간 초과로 게임이 일시 정지되었습니다. 플레이어의 선택을 기다리고 있습니다.'}
          </p>
          {canDecide && (
            <>
              <p className="text-cdm-fg-muted mt-3 text-xs">
                이어가면 현재 판을 유지하고 착수 시간을 처음부터 다시 부여합니다.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Button onClick={() => onDecision('continue')}>
                  {com ? '계속하기' : '게임 이어하기(봐주기)'}
                </Button>
                <Button variant="secondary" onClick={() => onDecision('finish')}>
                  {com ? '패배 인정' : '즉시 승리'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
