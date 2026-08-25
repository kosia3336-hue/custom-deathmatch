import { useLobbyChatStore } from '@/stores/lobbyChat';
import { useMailboxStore } from '@/stores/mailbox';

/** 로비 모달을 우편함 탭으로 열고, 해당 편지 본문을 보여 준다. */
export function presentMailbox(mailId: string): void {
  useMailboxStore.getState().setFocusId(mailId);
  useLobbyChatStore.getState().openMailbox();
}
