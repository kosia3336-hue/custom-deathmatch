'use client';

import MoonlitTableFx from './MoonlitTableFx';

interface Props {
  children: React.ReactNode;
}

/** CardArea 무월 테이블 래퍼 */
export default function MoonlitTableShell({ children }: Props) {
  return (
    <div className="skin-nocturne-table flex flex-col items-center gap-2 rounded-xl p-3 lg:gap-3 lg:p-5">
      <MoonlitTableFx />
      <div className="z-10 flex w-full flex-col items-center gap-2 lg:gap-3">
        {children}
      </div>
    </div>
  );
}
