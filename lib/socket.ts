import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/types';
import { getBrowserSupabase } from './supabase/client';
import { isSupabaseConfigured } from './supabase/env';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

/** SSR/프리렌더 시 `io()`·`window`를 쓰지 않는 no-op 소켓 (이벤트는 클라이언트에서만 구독) */
let ssrSocketStub: TypedSocket | null = null;

function getSsrSocketStub(): TypedSocket {
  if (ssrSocketStub) return ssrSocketStub;
  const stub = {
    id: '',
    connected: false,
    disconnected: true,
    auth: {},
    connect(): TypedSocket {
      return stub as unknown as TypedSocket;
    },
    disconnect() {},
    on(): TypedSocket {
      return stub as unknown as TypedSocket;
    },
    once(): TypedSocket {
      return stub as unknown as TypedSocket;
    },
    off(): TypedSocket {
      return stub as unknown as TypedSocket;
    },
    emit(): TypedSocket {
      return stub as unknown as TypedSocket;
    },
  };
  ssrSocketStub = stub as unknown as TypedSocket;
  return ssrSocketStub;
}

/** localStorage 사용 불가 환경(시크릿 모드 등)에서 세션 유지용 모듈-레벨 캐시 */
let fallbackToken: string | null = null;

export function getOrCreateSessionToken(): string {
  try {
    let token = localStorage.getItem('sessionToken');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('sessionToken', token);
    }
    return token;
  } catch {
    if (!fallbackToken) {
      fallbackToken = crypto.randomUUID();
    }
    return fallbackToken;
  }
}

/** 현재 Supabase access_token (없으면 null) */
async function getCurrentAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getBrowserSupabase();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function getSocket(): TypedSocket {
  if (typeof window === 'undefined') {
    return getSsrSocketStub();
  }
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? '';
    socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // 초기 auth 는 connectSocket() 안에서 동적으로 채운다
      auth: {},
    }) as TypedSocket;

    socket.on('connect', () => {
      const token = getOrCreateSessionToken();
      socket!.emit('session:restore', { token });
    });

    (window as unknown as Record<string, unknown>)['__s'] = socket;
  }
  return socket;
}

/**
 * Supabase access_token 으로 socket 인증 후 연결.
 * 미인증/만료 시 connect 자체가 거부되며 'connect_error' 가 발생한다.
 */
export async function connectSocket(): Promise<TypedSocket> {
  const s = getSocket();
  if (!s.connected) {
    const accessToken = await getCurrentAccessToken();
    s.auth = { accessToken };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
