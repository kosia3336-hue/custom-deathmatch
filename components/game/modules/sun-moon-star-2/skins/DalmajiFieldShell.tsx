'use client';

import type { SMS2MarkId } from '@/shared/types/sun-moon-star-2';
import type { ReactNode } from 'react';
import DalmajiFieldFx from './DalmajiFieldFx';
import { dalmajiSkyOf } from './dalmajiSky';

export default function DalmajiFieldShell({
  children,
  skyMark = null,
}: {
  children: ReactNode;
  skyMark?: SMS2MarkId | null;
}) {
  const sky = dalmajiSkyOf(skyMark);
  return (
    <div className={`skin-dalmaji-field skin-dalmaji-field--${sky}`}>
      <DalmajiFieldFx sky={sky} />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
