'use client';

import type { ReactNode } from 'react';
import CitadelFieldFx from './CitadelFieldFx';

export default function CitadelFieldShell({ children }: { children: ReactNode }) {
  return (
    <div className="skin-citadel-field relative overflow-hidden rounded-xl p-2 sm:p-3">
      <CitadelFieldFx />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
