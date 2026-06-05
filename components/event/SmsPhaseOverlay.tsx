'use client';

import { useEffect, useState } from 'react';
import type { SmsPhase } from '@/shared/types/sun-moon-star-event';

interface Props {
  phase: SmsPhase;
  isPlayer: boolean;
}

interface OverlayState {
  key: string;
  title: string;
  subtitle: string | null;
  accent: 'indigo' | 'amber' | 'violet';
}

const VISIBLE_MS = 1400;

export default function SmsPhaseOverlay({ phase, isPlayer }: Props) {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const next = buildOverlay(phase, isPlayer);
    if (!next) {
      setOverlay(null);
      setVisible(false);
      return;
    }
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    setOverlay(next);
    if (reduced) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }
    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(hideTimer);
  }, [phase, isPlayer]);

  if (!overlay) return null;

  const accentClass =
    overlay.accent === 'amber'
      ? 'border-amber-300/80 bg-amber-50/85 text-amber-700'
      : overlay.accent === 'violet'
        ? 'border-violet-300/80 bg-violet-50/85 text-violet-700'
        : 'border-indigo-300/80 bg-indigo-50/85 text-indigo-700';

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-(--cdm-z-overlay) flex items-start justify-center pt-16 lg:pt-24"
      key={overlay.key}
    >
      <div
        className={`flex flex-col items-center gap-1 rounded-2xl border px-6 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${accentClass} ${
          visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-95 opacity-0'
        }`}
      >
        <p className="text-base font-bold lg:text-lg">{overlay.title}</p>
        {overlay.subtitle && (
          <p className="text-[11px] opacity-80 lg:text-xs">{overlay.subtitle}</p>
        )}
      </div>
    </div>
  );
}

function buildOverlay(phase: SmsPhase, isPlayer: boolean): OverlayState | null {
  switch (phase) {
    case 'pickFirst':
      return {
        key: 'pickFirst',
        title: isPlayer ? '☀️ 1차 선택' : '1차 선택',
        subtitle: isPlayer ? '해 · 달 · 별 중 하나 (점수 없음)' : '모든 플레이어가 동시에 선택합니다',
        accent: 'indigo',
      };
    case 'pickSecond':
      return {
        key: 'pickSecond',
        title: isPlayer ? '✨ 2차 선택' : '2차 선택',
        subtitle: isPlayer ? '불빛에 맞춰 점수를 획득하세요' : '2차 선택으로 불빛이 결정됩니다',
        accent: 'amber',
      };
    case 'resolveFirst':
      return {
        key: 'resolveFirst',
        title: '☀️ 1차 집계',
        subtitle: '각 표식 선택 수 확인 (불빛·점수 없음)',
        accent: 'indigo',
      };
    case 'resolve':
      return {
        key: 'resolve',
        title: '✨ 불빛 판정',
        subtitle: '2차 최소 표식에 불빛이 켜집니다',
        accent: 'violet',
      };
    default:
      return null;
  }
}
