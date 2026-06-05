'use client';

import { useSkinFx } from '@/lib/skins/useSkinFx';

/** 무월 테이블 배경 FX — 별·달빛 스포트·먼지 */
export default function MoonlitTableFx() {
  const { lowSpec } = useSkinFx();
  return (
    <div className="skin-nocturne-fx" aria-hidden>
      <div className="skin-nocturne-spotlight" />
      <div className="skin-nocturne-stars" />
      <div className="skin-nocturne-moon-pool" />
      {!lowSpec && <div className="skin-nocturne-dust" />}
    </div>
  );
}
