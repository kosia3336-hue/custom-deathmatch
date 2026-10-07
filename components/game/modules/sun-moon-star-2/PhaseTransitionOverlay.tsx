'use client';

import type { SMS2GameData } from '@/shared/types/sun-moon-star-2';
import { useEffect, useState } from 'react';

/* ════════════════════════════════════════════════════════════
 * PhaseTransitionOverlay
 *   페이즈 전환 시 ~700ms 동안 큰 메시지를 살짝 깔아주는 오버레이.
 *   prefers-reduced-motion 사용자에겐 페이드 없이 0ms 표시 후 즉시 제거.
 *   클릭 차단하지 않음 (pointer-events-none).
 * ════════════════════════════════════════════════════════════ */

interface Props {
  phase: SMS2GameData['phase'];
  /** 본인의 행동 페이즈 여부 — 메시지 톤 보정용 */
  isMyTurn: boolean;
  isSpectator: boolean;
  /** 표시 라벨에 쓰는 닉네임 */
  firstNick: string;
  secondNick: string;
  myIsFirst: boolean;
}

interface OverlayState {
  key: string;
  title: string;
  subtitle: string | null;
  accent: 'indigo' | 'amber' | 'violet' | 'emerald';
}

const VISIBLE_MS = 1400;
const FADE_MS = 300;

export default function PhaseTransitionOverlay({
  phase,
  isMyTurn,
  isSpectator,
  firstNick,
  secondNick,
  myIsFirst,
}: Props) {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const next = buildOverlay({
      phase,
      isMyTurn,
      isSpectator,
      firstNick,
      secondNick,
      myIsFirst,
    });
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
      // 모션 감소: 짧게 깜빡이고 종료
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }

    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(hideTimer);
    // 페이즈 전환 시에만 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!overlay) return null;

  const accentClass =
    overlay.accent === 'amber'
      ? 'border-amber-300/80 bg-amber-50/85 text-amber-700'
      : overlay.accent === 'violet'
        ? 'border-violet-300/80 bg-violet-50/85 text-violet-700'
        : overlay.accent === 'emerald'
          ? 'border-emerald-300/80 bg-emerald-50/85 text-emerald-700'
          : 'border-indigo-300/80 bg-indigo-50/85 text-indigo-700';

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-0 z-(--cdm-z-overlay) flex items-start justify-center pt-20 lg:pt-32"
      key={overlay.key}
    >
      <div
        className={`pointer-events-none flex flex-col items-center gap-1 rounded-2xl border px-6 py-3 shadow-lg backdrop-blur-sm transition-all ${accentClass} ${
          visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-95 opacity-0'
        }`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <p className="text-base font-bold lg:text-lg">{overlay.title}</p>
        {overlay.subtitle && (
          <p className="text-[11px] opacity-80 lg:text-xs">{overlay.subtitle}</p>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────── */

function buildOverlay({
  phase,
  isMyTurn,
  isSpectator,
  firstNick,
  secondNick,
  myIsFirst,
}: {
  phase: SMS2GameData['phase'];
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst: boolean;
}): OverlayState | null {
  switch (phase) {
    case 'powder':
      return {
        key: 'powder',
        title: '빛가루 분배',
        subtitle: isSpectator ? '양측이 동시에 분배합니다' : '해 · 달 · 별에 비공개로 분배하세요',
        accent: 'indigo',
      };
    case 'betFirst': {
      const who = isSpectator ? firstNick : myIsFirst ? '나' : firstNick;
      const subtitle = isSpectator
        ? `${firstNick} (선) 베팅 시작`
        : isMyTurn
          ? '한도 내에서 자유롭게 베팅하세요'
          : `${who} (선) 베팅 대기 중`;
      return {
        key: 'betFirst',
        title: isMyTurn && !isSpectator ? '내 차례 — 선 베팅' : '선 베팅',
        subtitle,
        accent: 'amber',
      };
    }
    case 'betSecond': {
      const who = isSpectator ? secondNick : myIsFirst === false ? '나' : secondNick;
      const subtitle = isSpectator
        ? `${secondNick} (후) 베팅 시작`
        : isMyTurn
          ? '선의 2배 이상으로 베팅하세요'
          : `${who} (후) 베팅 대기 중`;
      return {
        key: 'betSecond',
        title: isMyTurn && !isSpectator ? '내 차례 — 후 베팅' : '후 베팅',
        subtitle,
        accent: 'amber',
      };
    }
    case 'resolve':
      return {
        key: 'resolve',
        title: '점등 판정',
        subtitle: '합산 최다 표식이 점등됩니다',
        accent: 'violet',
      };
    case 'roundEnd':
      return {
        key: 'roundEnd',
        title: '라운드 종료',
        subtitle: '곧 다음 라운드가 시작됩니다',
        accent: 'emerald',
      };
    default:
      return null;
  }
}
