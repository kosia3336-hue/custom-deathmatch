'use client';

import { useSocket } from '@/hooks/useSocket';
import { RankVsOverlay } from '@/components/rank/RankVsOverlay';
import { RankQueueClosingWatcher } from '@/components/rank/RankQueueClosingWatcher';
import { RankQueueFloatingIndicator } from '@/components/rank/RankQueueFloatingIndicator';
import { LobbyChatPanel } from '@/components/lobby/LobbyChatPanel';
import { MailboxDialog } from '@/components/lobby/MailboxDialog';

export default function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocket();
  return (
    <>
      {children}
      <RankVsOverlay />
      <RankQueueClosingWatcher />
      <RankQueueFloatingIndicator />
      <LobbyChatPanel />
      <MailboxDialog />
    </>
  );
}
