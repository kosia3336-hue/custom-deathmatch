'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { adUnit, type AdPlacement, type AdUnit } from '@/lib/ads';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const ADFIT_SRC = 'https://t1.daumcdn.net/kas/static/ba.min.js';

/** 애드센스 스크립트는 페이지에 한 번만 넣는다 */
function ensureAdsenseScript(client: string) {
  if (document.querySelector(`script[src^="${ADSENSE_SRC}"]`)) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `${ADSENSE_SRC}?client=${client}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

/**
 * 광고 한 칸. 설정(lib/ads.ts)이 없으면 아무것도 그리지 않는다.
 *
 * 화면을 옮겨도 같은 컴포넌트가 남는 경우가 있어(클라이언트 이동) 주소가 바뀌면
 * 광고 칸을 새로 만든다. 자리 높이를 미리 잡아 광고가 늦게 떠도 화면이 밀리지 않게 한다.
 */
export function AdSlot({ placement, className }: { placement: AdPlacement; className?: string }) {
  const unit = adUnit(placement);
  const pathname = usePathname();
  if (!unit) return null;
  return (
    <aside
      aria-label="광고"
      className={cn('flex w-full flex-col items-center gap-1', className)}
    >
      <span className="text-[10px] tracking-wide text-cdm-fg-subtle">광고</span>
      <AdUnitView key={`${placement}:${pathname}`} unit={unit} />
    </aside>
  );
}

function AdUnitView({ unit }: { unit: AdUnit }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';
    // 앱(웹뷰) 안에서는 애드센스·애드핏 정책상 광고를 띄우지 않는다
    if (document.documentElement.hasAttribute('data-native-app')) {
      host.parentElement?.setAttribute('hidden', '');
      return;
    }
    const ins = document.createElement('ins');

    if (unit.provider === 'adsense' && unit.client) {
      ensureAdsenseScript(unit.client);
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.style.width = '100%';
      ins.dataset.adClient = unit.client;
      ins.dataset.adSlot = unit.slot;
      ins.dataset.adFormat = 'auto';
      ins.dataset.fullWidthResponsive = 'true';
      host.appendChild(ins);
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // 광고 차단기 등 — 자리만 비워 둔다
      }
      return;
    }

    // 카카오 애드핏 — 스크립트가 불러올 때 칸을 찾아 채우므로 칸마다 다시 붙인다
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.dataset.adUnit = unit.slot;
    ins.dataset.adWidth = String(unit.width);
    ins.dataset.adHeight = String(unit.height);
    host.appendChild(ins);
    const s = document.createElement('script');
    s.async = true;
    s.src = ADFIT_SRC;
    host.appendChild(s);
  }, [unit]);

  return (
    <div
      ref={ref}
      className="flex w-full justify-center overflow-hidden"
      style={{ minHeight: unit.provider === 'adfit' ? unit.height : Math.min(unit.height, 100) }}
    />
  );
}
