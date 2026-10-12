'use client';

import { useSpectatorNotifications } from '@/hooks/useSpectatorNotifications';
import { setSpectatorNotifications } from '@/lib/chatSettings';
import { cn } from '@/lib/utils';

export default function ChatNotificationSettings() {
  const enabled = useSpectatorNotifications();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="관전자 입·퇴장 알림"
      onClick={() => setSpectatorNotifications(!enabled)}
      className="text-cdm-fg hover:bg-cdm-bg-elev-1 flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left text-sm transition-colors"
    >
      <span>관전자 입·퇴장 알림</span>
      <span
        className={cn(
          'rounded-cdm-md shrink-0 border px-3 py-1 text-xs font-medium',
          enabled ? 'border-cdm-primary text-cdm-primary' : 'border-cdm-border text-cdm-fg-muted',
        )}
      >
        {enabled ? '켜짐' : '꺼짐'}
      </span>
    </button>
  );
}
