'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * 로비 상단 메인 광고판 — 슬라이드 캐러셀.
 *
 * 원본(16:9) 전체가 잘리지 않게 축소해 중앙 배치하고,
 * 가장자리를 잉크색 그라데이션으로 페이드시켜 다크 밴드와 자연스럽게 섞는다.
 *
 * 슬라이드를 늘리려면 SLIDES 에 한 줄 추가하면 된다.
 * 누르면 어디로도 가지 않는다 — 대문 이미지를 공지로 이어 두었더니 로비에서
 * 무심코 누른 사람이 공지 화면으로 튕겨 나갔다.
 */
interface Slide {
  /** public/ 아래 경로 */
  src: string;
  alt: string;
  /** 점(인디케이터) 버튼의 접근성 이름 */
  label: string;
  /**
   * 16:9 가 아닌 이미지를 잘라 채울지. 대문 비율에 맞춰 잘라내고 위에 문구를
   * 얹어, '잘린 사진'이 아니라 의도된 배너로 보이게 한다.
   */
  cover?: boolean;
  /** cover 슬라이드에 얹는 문구 */
  caption?: { title: string; sub: string };
}

const SLIDES: Slide[] = [
  {
    src: '/brand/main-title.webp',
    alt: 'Custom Deathmatch',
    label: '커스텀 데스매치 대문',
  },
];

/** 자동 전환 간격. 읽을 시간을 주되 지루하지 않은 정도. */
const AUTO_MS = 6000;

export default function MainBillboard() {
  const [index, setIndex] = useState(0);
  /* 마우스를 올리거나 포커스가 들어오면 자동 전환을 멈춘다 — 읽는 중에 넘어가지 않게. */
  const pausedRef = useRef(false);

  useEffect(() => {
    if (SLIDES.length < 2) return;
    // 모션을 줄이도록 설정한 사용자에게는 자동 전환을 걸지 않는다(점으로 직접 이동은 가능).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const t = setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i + 1) % SLIDES.length);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative mx-auto w-full max-w-xl"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocusCapture={() => { pausedRef.current = true; }}
      onBlurCapture={() => { pausedRef.current = false; }}
    >
      {/* 대문 비율(16:9) 고정 — 슬라이드가 바뀌어도 로비가 들썩이지 않는다 */}
      <div className="relative aspect-[1152/648] w-full overflow-hidden">
        {SLIDES.map((s, i) => {
          const active = i === index;
          return (
            <div
              key={s.src}
              aria-hidden={!active}
              className={[
                'absolute inset-0 transition-opacity duration-700 ease-out',
                active ? 'opacity-100' : 'pointer-events-none opacity-0',
              ].join(' ')}
            >
              <Image
                src={s.src}
                alt={s.alt}
                fill
                // 첫 장만 우선 로드 — 나머지는 넘어갈 때 받아도 늦지 않다
                priority={i === 0}
                className={s.cover ? 'object-cover' : 'object-contain'}
                sizes="(max-width: 640px) 100vw, 576px"
              />

              {s.caption && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 px-4 text-center">
                  <span className="text-lg font-black tracking-tight text-white drop-shadow md:text-2xl">
                    {s.caption.title}
                  </span>
                  <span className="text-xs text-white/80 md:text-sm">{s.caption.sub}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* 가장자리 페이드 — 이미지 위 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, var(--cdm-ink), transparent 14%, transparent 86%, var(--cdm-ink)), linear-gradient(to bottom, var(--cdm-ink), transparent 16%, transparent 84%, var(--cdm-ink))',
          }}
        />
      </div>

      {/* 슬라이드 점 */}
      {SLIDES.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={s.label}
              aria-current={i === index}
              className={[
                'h-2 rounded-full transition-all',
                i === index ? 'w-5 bg-white/85' : 'w-2 bg-white/35 hover:bg-white/60',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
