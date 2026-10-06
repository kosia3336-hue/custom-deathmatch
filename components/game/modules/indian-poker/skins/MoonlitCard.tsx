'use client';

import { motion } from 'framer-motion';

export type MoonlitDealFly = { x: number; y: number };

interface Props {
  value: number | null;
  hidden?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  animateIn?: boolean;
  dealEnter?: boolean;
  dealFly?: MoonlitDealFly;
  className?: string;
}

export function MoonlitCardFace({ value, size }: { value: number; size: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <div
      className={`skin-nocturne-card-face-inner h-full w-full ${sm ? 'skin-nocturne-card--sm' : 'skin-nocturne-card--md'}`}
    >
      <span className="skin-nocturne-card-shimmer" aria-hidden />
      <span className="skin-nocturne-card-value">{value}</span>
    </div>
  );
}

export function MoonlitCardBack({ size }: { size: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <div
      className={`skin-nocturne-card-back-inner h-full w-full ${sm ? 'skin-nocturne-card--sm' : 'skin-nocturne-card--md'}`}
    >
      <div className="skin-nocturne-back-stars" aria-hidden />
      <div className="skin-nocturne-moon" aria-hidden>
        <span className="skin-nocturne-moon-disc" />
        <span className="skin-nocturne-moon-shade" />
      </div>
    </div>
  );
}

export default function MoonlitCard({
  value,
  hidden,
  label,
  size = 'md',
  animateIn = false,
  dealEnter = false,
  dealFly,
  className = '',
}: Props) {
  const show = !hidden && value !== null;
  const sizeClass = size === 'md' ? 'h-14 w-11 lg:h-20 lg:w-14' : 'h-11 w-9 lg:h-16 lg:w-12';

  const fly = dealEnter && dealFly ? dealFly : { x: 0, y: 0 };

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[11px] text-slate-300/80 lg:text-xs">{label}</span>}
      <motion.div
        key={dealEnter ? `deal-${value ?? 'back'}-${fly.x}-${fly.y}` : 'static'}
        initial={
          dealEnter
            ? {
                scale: 0.7,
                opacity: 0,
                x: fly.x,
                y: fly.y,
                rotate: fly.x > 0 ? 12 : fly.x < 0 ? -12 : 0,
              }
            : false
        }
        animate={{ scale: 1, opacity: 1, x: 0, y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 0.85 }}
        className={`skin-nocturne-card-wrap ${sizeClass} ${className} ${
          size === 'sm' ? 'skin-nocturne-card--sm' : 'skin-nocturne-card--md'
        } ${show ? 'skin-nocturne-card-wrap--face' : 'skin-nocturne-card-wrap--back'} ${
          dealEnter ? 'skin-nocturne-card-landed' : ''
        } ${animateIn && show ? 'skin-nocturne-card-flip' : ''}`}
      >
        {show ? <MoonlitCardFace value={value!} size={size} /> : <MoonlitCardBack size={size} />}
      </motion.div>
    </div>
  );
}
