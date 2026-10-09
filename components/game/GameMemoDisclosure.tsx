'use client';

import { BottomSheet } from '@/components/cdm/BottomSheet';
import { Button } from '@/components/cdm/Button';
import { Icon } from '@/components/cdm/Icon';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import type { SkinTheme } from '@/lib/skins/registry';
import { useRef, useState, type ReactNode } from 'react';
import { gamePanelSkinClass } from './GamePanelSkin';

type Props = { title: string; summary?: ReactNode; skin?: SkinTheme | null; children: ReactNode };

/** PC는 기존 패널, 모바일은 접힌 버튼으로 표시한다. 메모 값은 부모에서 유지한다. */
export function GameMemoDisclosure(props: Props) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  return desktop ? props.children : <MobileMemo {...props} />;
}

function MobileMemo({ title, summary, skin, children }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button
          ref={trigger}
          variant="secondary"
          size="md"
          leftIcon={<Icon name="memo" size="sm" />}
          aria-label={`${title} 메모 열기`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          메모 열기
        </Button>
        {summary && <span className="text-cdm-fg-muted text-xs tabular-nums">{summary}</span>}
      </div>
      <BottomSheet
        open={open}
        onClose={close}
        title={title}
        className={gamePanelSkinClass(skin, true)}
      >
        {children}
      </BottomSheet>
    </>
  );
}
