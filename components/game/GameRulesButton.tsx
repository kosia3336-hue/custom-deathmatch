'use client';

import { Icon } from '@/components/cdm';

/** 상단 바의 게임 룰 바로가기. 무르기 바로 왼쪽에 배치한다. */
export default function GameRulesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="게임 룰"
      title="게임 룰"
      className="rounded-cdm-md text-cdm-ink-fg-muted flex shrink-0 flex-col items-center gap-0.5 px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-white"
    >
      <Icon name="rules" />
      <span className="text-[11px] leading-none font-medium whitespace-nowrap">게임 룰</span>
    </button>
  );
}
