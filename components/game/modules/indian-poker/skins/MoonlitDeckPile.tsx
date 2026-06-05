'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  showShuffle?: boolean;
}

function DeckCard() {
  return (
    <div className="skin-nocturne-card-back-inner skin-nocturne-card--sm h-full w-full">
      <div className="skin-nocturne-back-stars" aria-hidden />
      <div className="skin-nocturne-moon" aria-hidden>
        <span className="skin-nocturne-moon-disc" />
        <span className="skin-nocturne-moon-shade" />
      </div>
    </div>
  );
}

const STACK = [
  { x: 9,   y: 9,   opacity: 0.30 },
  { x: 7,   y: 7,   opacity: 0.40 },
  { x: 5,   y: 5,   opacity: 0.55 },
  { x: 3,   y: 3,   opacity: 0.70 },
  { x: 1.5, y: 1.5, opacity: 0.85 },
  { x: 0,   y: 0,   opacity: 1.00 },
];

const FAN_POSITIONS = [
  { x: -28, y: -8,  rotate: -18 },
  { x: -16, y: -14, rotate: -9 },
  { x: -4,  y: -16, rotate: -2 },
  { x: 8,   y: -14, rotate: 5  },
  { x: 20,  y: -8,  rotate: 12 },
  { x: 30,  y: 0,   rotate: 18 },
];

export default function MoonlitDeckPile({ showShuffle = false }: Props) {
  const [isFanned, setIsFanned] = useState(false);

  useEffect(() => {
    if (showShuffle) {
      const t = setTimeout(() => setIsFanned(true), 150);
      return () => clearTimeout(t);
    }
    setIsFanned(false);
  }, [showShuffle]);

  return (
    <div className="pointer-events-none relative flex flex-col items-center self-end" aria-hidden>
      <div className="relative h-11 w-9 overflow-visible lg:h-16 lg:w-12">
        {STACK.map((s, i) => {
          const pos = isFanned ? FAN_POSITIONS[i] : null;
          const tx = pos ? pos.x : s.x;
          const ty = pos ? pos.y : s.y;
          const rot = pos ? pos.rotate : 0;
          return (
            <span
              key={i}
              className="skin-nocturne-card-wrap skin-nocturne-card-wrap--back skin-nocturne-card--sm !absolute inset-0 h-full w-full"
              style={{
                transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg)`,
                opacity: s.opacity,
                willChange: 'transform',
                transitionProperty: isFanned ? 'transform' : 'none',
                transitionDuration: isFanned ? '320ms' : '0ms',
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                transitionDelay: isFanned ? `${i * 40}ms` : '0ms',
              }}
            >
              <DeckCard />
            </span>
          );
        })}
      </div>

      <AnimatePresence>
        {showShuffle && (
          <motion.p
            key="shuffle-label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
            className="mt-2 whitespace-nowrap text-[11px] font-semibold tracking-wide text-slate-300/90 lg:text-xs"
          >
            셔플합니다
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
