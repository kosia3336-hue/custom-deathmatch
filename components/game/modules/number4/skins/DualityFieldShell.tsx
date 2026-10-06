'use client';

import type { ReactNode } from 'react';
import DualityFieldFx from './DualityFieldFx';
import styles from '../number-four.module.css';

export default function DualityFieldShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-number-four-selector
      data-skin="duality"
      className={`${styles.selector} skin-duality-field flex flex-col gap-4 p-4`}
    >
      <DualityFieldFx />
      <div className="relative z-10 flex flex-col gap-4">{children}</div>
    </div>
  );
}
