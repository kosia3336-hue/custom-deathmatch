import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/types';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

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
    // localStorage 사용 불가 시 모듈 변수에 캐싱하여 렌더마다 새 UUID 생성 방지
    if (!fallbackToken) {
      fallbackToken = crypto.randomUUID();
    }
    return fallbackToken;
  }
}

export function getSocket(): TypedSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? '';
    socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    }) as TypedSocket;

    socket.on('connect', () => {
      const token = getOrCreateSessionToken();
      socket!.emit('session:restore', { token });
    });
  }
  return socket;
}

export function connectSocket(): TypedSocket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
