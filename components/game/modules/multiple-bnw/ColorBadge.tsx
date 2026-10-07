'use client';

export function ColorBadge({ color, pulse }: { color: 'white' | 'black'; pulse?: boolean }) {
  return (
    <span
      className={`mbnw-color-badge mbnw-color-badge--${color} inline-flex h-10 items-center rounded-lg px-4 text-base font-semibold transition-all duration-200 ${
        pulse ? 'ring-2 ring-current ring-offset-1' : ''
      } ${
        color === 'black'
          ? 'bg-slate-800 text-slate-100 ring-slate-500'
          : 'border border-gray-300 bg-white text-slate-700 ring-gray-400'
      }`}
    >
      {color === 'black' ? '흑색' : '백색'}
    </span>
  );
}
