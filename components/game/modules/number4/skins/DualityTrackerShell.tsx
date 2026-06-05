'use client';

import type { ReactNode } from 'react';

export default function DualityTrackerShell({ children }: { children: ReactNode }) {
  return (
    <div className="skin-duality-tracker w-full p-3">{children}</div>
  );
}
