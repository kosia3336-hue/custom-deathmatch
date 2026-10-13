'use client';

import SocketProvider from '@/classic-era/components/providers/SocketProvider';
import NicknameModal from '@/classic-era/components/lobby/NicknameModal';

/** 2026-04-01 클라이언트. 소켓은 `/classic` 네임스페이스만 쓴다. */
export default function ClassicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="classic-era flex min-h-dvh flex-1 flex-col bg-gray-50 text-gray-900">
      <style>{`
        .classic-era :focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px #fff, 0 0 0 4px #6366f1;
        }
      `}</style>
      <SocketProvider>
        {children}
        <NicknameModal />
      </SocketProvider>
    </div>
  );
}
