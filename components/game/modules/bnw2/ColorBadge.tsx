'use client';

export function ColorBadge({ color, visible }: { color: 'black' | 'white'; visible: boolean }) {
  return (
    <span
      className={`inline-flex h-10 items-center rounded-lg px-5 text-base font-bold transition-all duration-500 ${
        visible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
      } ${
        color === 'black'
          ? 'bg-slate-800 text-slate-100'
          : 'border border-gray-300 bg-white text-slate-800'
      }`}
      style={{
        animation: visible
          ? 'bnw2PopIn 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards'
          : 'none',
      }}
    >
      {color === 'black' ? '■ 흑' : '□ 백'}
    </span>
  );
}
