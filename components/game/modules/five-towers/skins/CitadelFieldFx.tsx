'use client';

import { useSkinFx } from '@/lib/skins/useSkinFx';

export default function CitadelFieldFx() {
  const { lowSpec, reducedMotion } = useSkinFx();
  const animate = !lowSpec && !reducedMotion;

  return (
    <div className="skin-citadel-fx" aria-hidden>
      <div className="skin-citadel-moss skin-citadel-moss--tl" />
      <div className="skin-citadel-moss skin-citadel-moss--tr" />
      <div className="skin-citadel-moss skin-citadel-moss--bl" />
      <div className="skin-citadel-moss skin-citadel-moss--br" />
      {animate && (
        <>
          <div className="skin-citadel-torch skin-citadel-torch--left" />
          <div className="skin-citadel-torch skin-citadel-torch--right" />
        </>
      )}
      {!animate && (
        <>
          <div className="skin-citadel-torch skin-citadel-torch--left skin-citadel-torch--static" />
          <div className="skin-citadel-torch skin-citadel-torch--right skin-citadel-torch--static" />
        </>
      )}
    </div>
  );
}
