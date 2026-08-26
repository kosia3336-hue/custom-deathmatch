'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import type { TitleColor } from '@/lib/supabase/database.types';

export type TitleEffect = 'legend' | 'xuanwu' | 'baekho' | 'jujak' | 'eternal' | 'issen' | 'seongha' | 'sakura' | 'frost' | 'lightning' | 'wave' | 'dojang';

const EFFECT_CLASS: Record<TitleEffect, string> = {
  legend: 'title-legend',
  xuanwu: 'title-xuanwu',
  baekho: 'title-baekho',
  jujak: 'title-jujak',
  eternal: 'title-eternal',
  issen: 'title-issen',
  seongha: 'title-seongha',
  sakura: 'title-sakura',
  frost: 'title-frost',
  lightning: 'title-lightning',
  wave: 'title-wave',
  dojang: 'title-dojang',
};

interface TitleBadgeProps {
  name: string;
  color: TitleColor;
  effect?: TitleEffect | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'px-[7px] py-[1px] text-[11px]',
  md: 'px-[9px] py-[2px] text-xs',
  lg: 'px-[11px] py-1 text-sm',
};

/**
 * 칭호 뱃지. 아웃라인(테두리+글자 동색, 배경 투명) 스타일.
 * effect 지정 시 해당 테마 shimmer 애니메이션 적용.
 *
 * docs/v2/15_common_ui.md §15.9.2
 */
export function TitleBadge({ name, color, effect, size = 'md', className }: TitleBadgeProps) {
  if (effect === 'dojang') {
    return <TitleDojangMark name={name} size={size} className={className} />;
  }

  const effectClass = effect ? EFFECT_CLASS[effect] : null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
        SIZE_CLASS[size],
        effectClass,
        className,
      )}
      style={effectClass ? undefined : {
        borderColor: `var(--title-${color})`,
        color: `var(--title-${color})`,
      }}
    >
      {effect === 'issen' ? (
        <>
          <span className="title-issen-label" data-text={name}>
            {name}
          </span>
          <span className="title-issen-slash" aria-hidden>
            <span className="title-issen-blade" />
          </span>
        </>
      ) : effect === 'seongha' ? (
        <>
          <span className="title-seongha-label">{name}</span>
          <span className="title-seongha-sparks" aria-hidden>
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
          </span>
        </>
      ) : effect === 'sakura' ? (
        <>
          <span className="title-sakura-label">{name}</span>
          <span className="title-sakura-petals" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="title-sakura-petal" />
            ))}
          </span>
        </>
      ) : effect === 'frost' ? (
        <>
          <span className="title-frost-label">{name}</span>
          <span className="title-frost-crystals" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={`c${i}`} className="title-frost-crystal" />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <span key={`s${i}`} className="title-frost-shard" />
            ))}
          </span>
        </>
      ) : effect === 'lightning' ? (
        <>
          <span className="title-lightning-label">{name}</span>
          <span className="title-lightning-fx" aria-hidden>
            <span className="title-lightning-bolt" />
            <span className="title-lightning-bang" />
            <span className="title-lightning-bang" />
            <span className="title-lightning-bang" />
            <span className="title-lightning-fork title-lightning-fork-l" />
            <span className="title-lightning-fork title-lightning-fork-r" />
          </span>
        </>
      ) : effect === 'wave' ? (
        <TitleWaveMark name={name} />
      ) : effect === 'jujak' ? (
        <TitleJujakMark name={name} />
      ) : (
        name
      )}
    </span>
  );
}

function TitleJujakMark({ name }: { name: string }) {
  return (
    <>
      <span className="title-jujak-label" data-text={name}>{name}</span>
      <span className="title-jujak-fx" aria-hidden>
        {/* 내려온 깃털이 하단에 닿은 뒤 불씨로 바뀌는 시간차를 만든다. */}
        {Array.from({ length: 7 }, (_, i) => (
          <span key={`feather-${i}`} className="title-jujak-feather" />
        ))}
        {/* 하단 중심에서 점화되어 좌우로 번지는 실제 화염 혀. */}
        {Array.from({ length: 9 }, (_, i) => (
          <span key={`flame-${i}`} className="title-jujak-flame" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <span key={`ember-${i}`} className="title-jujak-ember" />
        ))}
      </span>
    </>
  );
}

function TitleWaveMark({ name }: { name: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <>
      <span className="title-wave-label">{name}</span>
      <span className="title-wave-fx" aria-hidden>
        <svg className="title-wave-sea" viewBox="0 0 200 24" preserveAspectRatio="none">
          <path
            className="title-wave-fill-deep"
            d="M0 24V14Q25 7 50 14T100 14T150 14T200 14V24Z"
          />
          <path
            className="title-wave-fill-mid"
            d="M0 24V11Q25 3.5 50 11T100 11T150 11T200 11V24Z"
          />
          <path
            className="title-wave-glint"
            d="M0 11Q25 3.5 50 11T100 11T150 11T200 11"
          />
        </svg>
        <svg className="title-wave-sea title-wave-sea-2" viewBox="0 0 200 24" preserveAspectRatio="none">
          <path
            className="title-wave-fill-light"
            d="M0 24V16Q20 10.5 40 16T80 16T120 16T160 16T200 16V24Z"
          />
        </svg>
        <span className="title-wave-breaker">
          <svg viewBox="0 0 110 24" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="14%" stopColor="#d8f6fc" />
                <stop offset="36%" stopColor="#3ec4d6" />
                <stop offset="68%" stopColor="#147a98" />
                <stop offset="100%" stopColor="#0a3e58" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#${uid}-body)`}
              d="M0 24L0 14.6C16 14.6 26 12.4 38 13.2C52 14.1 62 8.8 74 6C82 4.2 90 2.1 96 2.3C101 2.5 104.2 4.8 103.6 8.1C103 11.2 98 11.6 93 12.3C88 13 85 13.4 83 15C92 14.1 100 16.6 106 20.6C108 22.1 109.4 23.2 111 24Z"
            />
            <path
              className="title-wave-break-face"
              d="M93 12.3C100 14.2 106 18.2 111 24H99C97.5 19.2 95 15.2 89.5 13.6Z"
            />
            <path
              className="title-wave-break-foam"
              d="M70 7C80 3.8 90 1.8 96 2.4C100.2 2.8 103.2 5.2 102.2 7.6C98 6 90 6.1 81.5 7.6C75.5 8.4 72 8.1 70 7Z"
            />
            <path className="title-wave-break-foam" d="M74 4.3L76.3.1 79 4.6Z" />
            <path className="title-wave-break-foam" d="M81.2 3.2L83.6-.5 86.4 3.7Z" />
            <path className="title-wave-break-foam" d="M88.2 2.5L90.8-.3 93.4 3.2Z" />
            <path className="title-wave-break-foam" d="M95 2.7L97.2.3 99 3.5Z" />
          </svg>
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
        </span>
      </span>
    </>
  );
}

function TitleDojangMark({
  name,
  size,
  className,
}: {
  name: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('title-dojang-wrap', className)}>
      <span className="title-dojang-stamp" aria-hidden>
        <svg viewBox="0 0 80 24" preserveAspectRatio="none">
          <rect x="34" y="0" width="12" height="4" rx="1" fill="#3a2416" />
          <rect x="31" y="3" width="18" height="3" rx="1" fill="#5a3824" />
          <rect x="1" y="5" width="78" height="15" rx="2.5" fill="#6b4028" />
          <rect x="4" y="7" width="72" height="11" rx="1.5" fill="#8b5a38" />
          <rect x="8" y="8.5" width="64" height="8" fill="none" stroke="#f0d4b0" strokeWidth="1.3" />
          <rect x="1" y="19" width="78" height="5" rx="1" fill="#b01820" />
        </svg>
      </span>
      <span
        className={cn(
          'title-dojang inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
          SIZE_CLASS[size],
        )}
      >
        <span className="title-dojang-label">{name}</span>
      </span>
    </span>
  );
}
