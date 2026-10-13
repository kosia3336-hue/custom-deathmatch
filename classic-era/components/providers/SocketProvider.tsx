'use client';

import { useSocket } from '@/classic-era/hooks/useSocket';

export default function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket();
  return <>{children}</>;
}
