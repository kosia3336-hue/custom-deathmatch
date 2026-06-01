'use client';

import { useEffect, useState } from 'react';

export interface SkinFxConfig {
  /** 모션 감소 선호 시 true — 입자/지속 애니메이션 비활성 */
  reducedMotion: boolean;
  /** 저사양(코어 4 이하 등) 추정 시 true — 입자 수 축소 */
  lowSpec: boolean;
  /** 권장 입자 수 (테마별 상한에 곱해 사용) */
  particleScale: number;
}

/**
 * 스킨 이펙트 강도 게이트.
 * - prefers-reduced-motion 존중
 * - 저사양 기기에서는 입자/블러 비용을 낮춘다
 */
export function useSkinFx(): SkinFxConfig {
  const [cfg, setCfg] = useState<SkinFxConfig>({
    reducedMotion: false,
    lowSpec: false,
    particleScale: 1,
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const lowSpec = cores <= 4 || mem <= 4;

    const update = () => {
      const reduced = mq.matches;
      setCfg({
        reducedMotion: reduced,
        lowSpec,
        particleScale: reduced ? 0 : lowSpec ? 0.5 : 1,
      });
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return cfg;
}
