'use client';

import { useSyncExternalStore } from 'react';
import { getSpectatorNotifications, subscribeChatSettings } from '@/lib/chatSettings';

export function useSpectatorNotifications(): boolean {
  return useSyncExternalStore(subscribeChatSettings, getSpectatorNotifications, () => true);
}
