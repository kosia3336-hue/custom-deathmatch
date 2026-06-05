'use client';

import { useSkinFx } from '@/lib/skins/useSkinFx';

export default function DualityFieldFx() {
  const { lowSpec } = useSkinFx();
  return (
    <div className="skin-duality-fx" aria-hidden>
      <div className="skin-duality-split-line" />
      {!lowSpec && (
        <>
          <div className="skin-duality-frost-glow" />
          <div className="skin-duality-ember-glow" />
        </>
      )}
    </div>
  );
}
