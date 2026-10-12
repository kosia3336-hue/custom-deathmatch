import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSpectatorNotifications,
  setSpectatorNotifications,
  subscribeChatSettings,
  isChatMessageVisible,
} from '../../../lib/chatSettings';
import type { ChatMessage } from '../../../shared/types';

afterEach(() => vi.unstubAllGlobals());

describe('관전자 알림 개인 설정', () => {
  it('기본값은 켜짐이며 끄기와 켜기를 브라우저에 저장하고 구독자에게 알린다', () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const notify = vi.fn();
    const unsubscribe = subscribeChatSettings(notify);
    expect(getSpectatorNotifications()).toBe(true);
    setSpectatorNotifications(false);
    expect(getSpectatorNotifications()).toBe(false);
    expect(entries.get('cdm-spectator-notifications')).toBe('off');
    setSpectatorNotifications(true);
    expect(getSpectatorNotifications()).toBe(true);
    expect(entries.get('cdm-spectator-notifications')).toBe('on');
    expect(notify).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('저장된 꺼짐 설정을 다시 불러온다', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => 'off' } });
    expect(getSpectatorNotifications()).toBe(false);
  });

  it('관전자 입·퇴장만 숨기며 채팅 원본, 일반 대화, 다른 시스템 메시지는 유지한다', () => {
    const message: ChatMessage = {
      id: 'join',
      sender: 'system',
      senderNickname: '시스템',
      scope: 'room',
      isSystem: true,
      message: '관전자 입장',
      timestamp: 1,
      systemEvent: 'spectator_join',
    };
    const messages = [
      message,
      { ...message, id: 'leave', systemEvent: 'spectator_leave' as const },
      { ...message, id: 'settings', systemEvent: undefined, message: '방 설정 변경' },
      { ...message, id: 'user', isSystem: false, message: '관전자 입장이라는 일반 대화' },
    ];
    expect(messages.filter((m) => isChatMessageVisible(m, false)).map((m) => m.id)).toEqual([
      'settings',
      'user',
    ]);
    expect(messages.filter((m) => isChatMessageVisible(m, true))).toHaveLength(4);
    expect(messages).toHaveLength(4);
  });
});
