'use client';

import { useState } from 'react';
import type { GameTool } from '@/contexts/GameToolsContext';
import type { SkinTheme } from '@/lib/skins/registry';
import { gameReferenceKind } from '@/lib/gameReferencePolicy';
import { BottomSheet } from '@/components/cdm/BottomSheet';
import { Icon } from '@/components/cdm/Icon';
import { gamePanelSkinClass } from './GamePanelSkin';

/** 채팅과 독립적인 모바일 기록 창. PC에서는 같은 원본을 오른쪽에 표시한다. */
export default function GameHistoryAction({
  tools,
  desktop,
  skin,
}: {
  tools: GameTool[];
  desktop: boolean;
  skin?: SkinTheme | null;
}) {
  const [open, setOpen] = useState(false);
  if (desktop && open) setOpen(false);
  const records = tools.filter(
    (tool) => (tool.kind ?? gameReferenceKind(tool.title)) === 'history',
  );
  if (desktop || !records.length) return null;
  return (
    <>
      <button
        type="button"
        aria-label="라운드 기록"
        title="라운드 기록"
        onClick={() => setOpen(true)}
        className="text-cdm-ink-fg-muted rounded-cdm-md flex flex-col items-center gap-0.5 px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Icon name="memo" />
        <span className="text-[11px] leading-none font-medium">기록</span>
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="라운드 기록"
        className={gamePanelSkinClass(skin, true)}
      >
        {records.map((tool) => (
          <section key={tool.id} aria-label={tool.title}>
            {records.length > 1 && (
              <h3 className="text-cdm-fg-muted mb-2 text-xs font-semibold">{tool.title}</h3>
            )}
            {tool.content}
          </section>
        ))}
      </BottomSheet>
    </>
  );
}
