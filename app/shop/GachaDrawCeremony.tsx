'use client';

import { motion } from 'framer-motion';

interface Props {
  reducedMotion: boolean;
}

export default function GachaDrawCeremony({ reducedMotion }: Props) {
  const particleCount = reducedMotion ? 0 : 6;

  return (
    <motion.div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[min(50dvh,320px)] flex-col items-center justify-center gap-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative flex h-32 w-32 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-cdm-primary/20"
          animate={reducedMotion ? {} : { scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="relative text-5xl"
          animate={reducedMotion ? {} : { rotate: [0, 8, -8, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
        </motion.span>
        {!reducedMotion &&
          Array.from({ length: particleCount }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-cdm-primary/60"
              style={{
                top: '50%',
                left: '50%',
                marginTop: -4,
                marginLeft: -4,
              }}
              animate={{
                x: [0, Math.cos((i / particleCount) * Math.PI * 2) * 48],
                y: [0, Math.sin((i / particleCount) * Math.PI * 2) * 48],
                opacity: [0.8, 0.2],
              }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
      </div>
      <p className="text-sm font-medium text-cdm-fg">뽑는 중이에요…</p>
    </motion.div>
  );
}
