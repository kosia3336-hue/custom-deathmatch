'use client';

export function Reveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`transition-all duration-500 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
    >
      {children}
    </div>
  );
}
