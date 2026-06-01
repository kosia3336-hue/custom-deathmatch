'use client';

import { useSkinFx } from '@/lib/skins/useSkinFx';

/** 코스모스 스킨의 보드 배경 이펙트 (별빛 + 성운). 순수 CSS 기반. */
export default function CosmosFx() {
  const { lowSpec } = useSkinFx();
  return (
    <div className="skin-cosmos-fx" aria-hidden>
      <div className="skin-cosmos-stars" />
      {/* 성운은 블러 비용이 있어 저사양에서는 생략 */}
      {!lowSpec && <div className="skin-cosmos-nebula" />}
    </div>
  );
}
