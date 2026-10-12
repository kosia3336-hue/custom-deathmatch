'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
 *
 * ── 반드시 body 로 포털한다 ─────────────────────────────────
 * 여는 버튼이 어디에 있든 시트는 화면 기준이다. 특히 상단 바는 .ink-scope 라
 * --cdm-bg 를 transparent 로 덮어쓴다 — 그 안에서 그대로 렌더하면 시트 배경이
 * 통째로 비쳐 보인다. 대기실 채팅이 실제로 그렇게 깨졌다.
 *
 * ── 닫혀 있으면 내용을 만들지 않는다 ────────────────────────
 * 예전 Modal 은 닫히면 null 을 돌려줘 자식이 아예 안 붙었다. 시트도 같아야
 * 한다. 안 그러면 대기실에 들어서자마자 채팅 본문이 붙어 소켓을 잡고,
 * '닫혀 있으니 읽은 것' 으로 쳐서 미읽음 배지가 바로 사라진다.
 * 닫는 애니메이션 동안만 잠깐 더 남겨 둔다.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  headerRight,
  headerTitle,
  children,
  className,
  bodyClassName,
  keyboardAware = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 제목 줄 오른쪽에 얹는 것 (탭, 개수 배지 따위) */
  headerRight?: React.ReactNode;
  headerTitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** 채팅처럼 키보드를 사용하는 시트는 실제 보이는 화면 안에 맞춘다. */
  keyboardAware?: boolean;
}) {
  /*
    한 번도 안 열었으면 아무것도 만들지 않는다. 한 번 열고 나면 그대로 둔다 —
    닫는 애니메이션이 끝까지 보이고, 다시 열 때 스크롤 자리도 남는다.

    렌더 중에 상태를 맞추는 것은 React 가 권하는 '프롭에서 파생된 상태' 방식이다.
    effect 로 미루면 한 프레임 늦게 열려 시트가 튀어 오른다.
  */
  const [everOpened, setEverOpened] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  if (open && !everOpened) setEverOpened(true);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open) {
      if (
        sheet?.contains(document.activeElement) &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
      return;
    }
    if (!keyboardAware || !sheet) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const fitViewport = () => {
      sheet.style.bottom = `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`;
      sheet.style.maxHeight = `${viewport.height * 0.8}px`;
      sheet.style.setProperty('--sheet-viewport-height', `${viewport.height}px`);
    };
    fitViewport();
    viewport.addEventListener('resize', fitViewport);
    viewport.addEventListener('scroll', fitViewport);
    return () => {
      viewport.removeEventListener('resize', fitViewport);
      viewport.removeEventListener('scroll', fitViewport);
      // 숨겨진 입력창의 포커스가 키보드를 유지하거나 시트를 다시 스크롤하지 않게 한다.
      if (sheet.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, [open, keyboardAware]);

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

  // 첫 렌더에는 아무것도 안 내보내므로 서버/클라가 어긋나지 않는다. document 도 이미 있다.
  if (!everOpened) return null;

  return createPortal(
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
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          'fixed inset-x-0 bottom-0 z-(--cdm-z-modal) mx-auto flex max-h-[80dvh] w-full max-w-2xl',
          'border-cdm-border bg-cdm-bg flex-col rounded-t-2xl border-t shadow-(--cdm-shadow-md)',
          'transition-transform duration-300',
          open ? 'translate-y-0' : 'pointer-events-none translate-y-full',
          className,
        )}
      >
        {/* 손잡이 — 이 판이 아래로 내려가는 물건이라는 표시 */}
        <div className="flex justify-center pt-2" aria-hidden>
          <span className="bg-cdm-border-strong h-1 w-9 rounded-full" />
        </div>

        <div data-panel-header className="flex shrink-0 items-center gap-2 px-4 py-2.5">
          <h2 className="text-cdm-fg min-w-0 flex-1 truncate text-sm font-bold">
            {headerTitle ?? title}
          </h2>
          {headerRight}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-cdm-md text-cdm-fg-subtle hover:bg-cdm-bg-elev-2 hover:text-cdm-fg p-1.5 transition-colors"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(var(--cdm-safe-bottom,0px)+1rem)]',
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}
