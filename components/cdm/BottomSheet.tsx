'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/**
 * 아래에서 올라오는 판(bottom sheet).
 *
 * 게임 화면에서 '지금 손으로 할 일' 은 전부 이 모양으로 올라온다 —
 * 베팅 입력, 채팅, 메모. 예전에는 베팅만 시트였고 채팅은 화면 한가운데
 * 뜨는 모달이라, 같은 게임 안에서 두 가지 문법이 섞여 어색했다.
 *
 * 가운데 모달이 아니라 아래에서 올라오는 이유는 손이 아래에 있기 때문이다.
 * 판을 덜 가리고, 엄지로 닫을 수 있고, 올라오는 방향이 '내가 부른 것' 이라는
 * 신호가 된다. 게임 화면 밖(로비·설정)의 확인 창은 여전히 Modal 을 쓴다 —
 * 거기서는 판을 가릴 걱정이 없고, 화면 가운데가 더 강한 주목을 만든다.
 *
 * 높이는 내용만큼 잡되 화면의 80% 를 넘지 않는다. 넘치는 부분은 시트 안에서
 * 스크롤한다 — 게임 무대는 스크롤하지 않지만(GameFrame 참고) 시트 안은
 * 스크롤해도 된다. 판이 아니라 잠깐 열었다 닫는 서랍이기 때문이다.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  headerRight,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 제목 줄 오른쪽에 얹는 것 (탭, 개수 배지 따위) */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  /* 시트가 열려 있는 동안 뒤 화면이 따라 스크롤되지 않게 한다. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* 바깥을 눌러도 닫힌다. 닫는 방법이 X 하나뿐이면 엄지가 위로 올라가야 한다. */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-(--cdm-z-overlay) bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        className={cn(
          'fixed inset-x-0 bottom-0 z-(--cdm-z-modal) mx-auto flex max-h-[80dvh] w-full max-w-2xl',
          'flex-col rounded-t-2xl border-t border-cdm-border bg-cdm-bg shadow-(--cdm-shadow-md)',
          'transition-transform duration-300',
          open ? 'translate-y-0' : 'pointer-events-none translate-y-full',
          className,
        )}
      >
        {/* 손잡이 — 이 판이 아래로 내려가는 물건이라는 표시 */}
        <div className="flex justify-center pt-2" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-cdm-border-strong" />
        </div>

        <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-cdm-fg">{title}</h2>
          {headerRight}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-cdm-md p-1.5 text-cdm-fg-subtle transition-colors hover:bg-cdm-bg-elev-2 hover:text-cdm-fg"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]',
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
