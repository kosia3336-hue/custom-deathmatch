'use client';

import type { BankPhase } from '@/shared/types/bank-game';
import { useEffect, useState } from 'react';

interface Props {
  phase: BankPhase;
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst: boolean;
}

interface OverlayState {
  key: string;
  title: string;
  subtitle: string | null;
  accent: 'indigo' | 'amber' | 'violet' | 'emerald' | 'rose';
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
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }

    setVisible(true);
    const hideTimer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(hideTimer);
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
          : overlay.accent === 'rose'
            ? 'border-rose-300/80 bg-rose-50/85 text-rose-700'
            : 'border-indigo-300/80 bg-indigo-50/85 text-indigo-700';

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-0 z-(--cdm-z-overlay) flex items-start justify-center pt-20 lg:pt-32"
      key={overlay.key}
    >
      <div
        className={`bank-phase-overlay pointer-events-none flex flex-col items-center gap-1 rounded-2xl border px-6 py-3 shadow-lg backdrop-blur-sm transition-all ${accentClass} ${
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

function buildOverlay({
  phase,
  isMyTurn,
  isSpectator,
  firstNick,
  secondNick,
  myIsFirst,
}: {
  phase: BankPhase;
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst: boolean;
}): OverlayState | null {
  switch (phase) {
    case 'firstSubmit': {
      const subtitle = isSpectator
        ? `${firstNick} (선) 베팅 시작`
        : myIsFirst
          ? '장수와 금액을 비공개로 결정하세요'
          : `${firstNick} (선) 베팅 대기 중`;
      return {
        key: 'firstSubmit',
        title: isMyTurn && !isSpectator ? '내 차례 — 선 베팅' : '선 베팅',
        subtitle,
        accent: 'indigo',
      };
    }
    case 'firstReveal': {
      return {
        key: 'firstReveal',
        title: '선 장수 공개',
        subtitle: '금액은 비공개 — 후가 추리합니다',
        accent: 'amber',
      };
    }
    case 'secondSubmit': {
      const subtitle = isSpectator
        ? `${secondNick} (후) 베팅 시작`
        : myIsFirst
          ? `${secondNick} (후) 베팅 대기 중`
          : '선의 장수를 보고 단가를 추리하세요';
      return {
        key: 'secondSubmit',
        title: isMyTurn && !isSpectator ? '내 차례 — 후 베팅' : '후 베팅',
        subtitle,
        accent: 'amber',
      };
    }
    case 'reveal':
      return {
        key: 'reveal',
        title: '정산',
        subtitle: '패자 금액 공개 — 승자 금액 비공개',
        accent: 'violet',
      };
    case 'roundEnd':
      return {
        key: 'roundEnd',
        title: '라운드 종료',
        subtitle: '다음 라운드 준비',
        accent: 'emerald',
      };
    case 'finished':
      return {
        key: 'finished',
        title: '게임 종료',
        subtitle: '기록실에서 모든 정보 공개',
        accent: 'emerald',
      };
    default:
      return null;
  }
}
