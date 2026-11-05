'use client';

import { useEffect, useRef } from 'react';
import { subscribeDragon } from './cheongryong-runtime';
import { dragonPixelRatio } from './cheongryong-performance';

/** 문서당 공유 GPU/시계 한 개. 화면 밖/숨긴 탭/모션 감소에서는 반복 렌더하지 않는다. */
export function CheongryongDragon({ className }: { className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const subscription = subscribeDragon(canvas);
    const resize = () => {
      const ratio = dragonPixelRatio(window.devicePixelRatio || 1);
      // 미리보기/상위 UI의 CSS 확대도 반영해 낮은 DPR에서 장식이 확대·흐려지지 않게 한다.
      const bounds = canvas.getBoundingClientRect();
      const pixelWidth = Math.max(canvas.clientWidth, bounds.width) * ratio;
      const pixelHeight = Math.max(canvas.clientHeight, bounds.height) * ratio;
      const cap = Math.min(1, 820 / pixelWidth, 430 / pixelHeight);
      const width = Math.max(1, Math.round(pixelWidth * cap));
      const height = Math.max(1, Math.round(pixelHeight * cap));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context) { context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'low'; }
      subscription.resize();
    };
    const sizing = new ResizeObserver(resize);
    sizing.observe(canvas);
    window.addEventListener('resize', resize);
    const visibility = new IntersectionObserver(([entry]) => subscription.visible(entry.isIntersecting));
    visibility.observe(canvas);
    resize();
    return () => { sizing.disconnect(); visibility.disconnect(); window.removeEventListener('resize', resize); subscription.dispose(); };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" data-dragon-motion="path" />;
}
