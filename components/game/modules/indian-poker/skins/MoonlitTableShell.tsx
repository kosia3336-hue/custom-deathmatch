'use client';

import MoonlitTableFx from './MoonlitTableFx';
import styles from '../indian-poker.module.css';

interface Props {
  children: React.ReactNode;
  contentClassName?: string;
}

/** CardArea 무월 테이블 래퍼 */
export default function MoonlitTableShell({ children, contentClassName = '' }: Props) {
  return (
    <div
      className={`${styles.tableShell} skin-nocturne-table w-full max-w-[22rem] shrink-0 rounded-xl p-3 lg:p-5`}
    >
      <MoonlitTableFx />
      <div className={`${contentClassName} relative z-10`}>{children}</div>
    </div>
  );
}
