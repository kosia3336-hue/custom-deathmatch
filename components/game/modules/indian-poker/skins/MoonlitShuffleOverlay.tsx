'use client';

import { MoonlitCardBack } from './MoonlitCard';

interface Props {
  show: boolean;
  ante: number;
}

export default function MoonlitShuffleOverlay({ show, ante }: Props) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center bg-slate-950/75 transition-opacity duration-500 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`skin-nocturne-shuffle-panel flex flex-col items-center gap-4 rounded-3xl px-12 py-8 text-center transition-transform duration-500 ${
          show ? 'scale-100' : 'scale-90'
        }`}
      >
        <div className="skin-nocturne-shuffle-cards flex items-end gap-1">
          <span className="skin-nocturne-card-wrap skin-nocturne-card-wrap--back skin-nocturne-card--md h-14 w-10 lg:h-16 lg:w-12">
            <MoonlitCardBack size="md" />
          </span>
          <span className="skin-nocturne-card-wrap skin-nocturne-card-wrap--back skin-nocturne-card--md mb-1 h-12 w-9 opacity-80 lg:h-14 lg:w-11">
            <MoonlitCardBack size="md" />
          </span>
          <span className="skin-nocturne-card-wrap skin-nocturne-card-wrap--back skin-nocturne-card--md mb-2 h-10 w-8 opacity-50 lg:h-12 lg:w-10">
            <MoonlitCardBack size="md" />
          </span>
        </div>
        <div>
          <p className="text-2xl font-bold tracking-wide text-slate-100">카드를 셔플합니다</p>
          <p className="mt-1 text-sm text-slate-400">앤트 {ante}개로 인상됩니다</p>
        </div>
      </div>
    </div>
  );
}
