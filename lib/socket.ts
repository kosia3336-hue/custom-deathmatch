import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/types';
import { getBrowserSupabase } from './supabase/client';
import { isSupabaseConfigured } from './supabase/env';
import { syncServerClock } from './serverClock';

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

/** 재인증 재연결 최소 간격 — 갱신이 계속 실패해도 재연결 폭주를 막는다. */
const REAUTH_MIN_INTERVAL_MS = 5_000;
let lastReauthAt = 0;

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

/** 서버가 세션 토큰을 재발급했을 때 로컬 토큰을 교체한다. */
function replaceSessionToken(token: string): void {
  try {
    localStorage.setItem('sessionToken', token);
  } catch {
    fallbackToken = token;
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
      // auth 를 함수로 준다 — socket.io 가 '연결을 시도할 때마다' 호출하므로
      // 재연결 시점의 최신 access_token 이 실린다.
      //
      // 고정 객체로 두면 처음 연결할 때 담은 토큰이 계속 재사용된다. 모바일에서
      // 백그라운드로 오래 있다 돌아오면 그 토큰은 이미 만료돼 있고, 서버는 만료
      // 토큰을 UNAUTHENTICATED 로 거부한다(게스트로 강등하지 않는다). 그러면
      // 재연결이 10회 모두 실패하고 조용히 오프라인 상태가 된다.
      auth: (cb: (data: { accessToken: string | null }) => void) => {
        getCurrentAccessToken()
          .then((accessToken) => cb({ accessToken }))
          .catch(() => cb({ accessToken: null }));
      },
    }) as TypedSocket;

    socket.on('connect', () => {
      const token = getOrCreateSessionToken();
      socket!.emit('session:restore', { token });
      // 기기 시계 오차를 잰다 — 타이머가 서버 마감과 같은 시각을 가리키도록.
      void syncServerClock(socket!);
    });

    // 앱을 내렸다 올리면 그 사이 기기 시계가 바뀌었을 수 있다(수동 변경·절전).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && socket?.connected) void syncServerClock(socket);
    });

    // 서버가 토큰을 재발급한 경우(다른 회원에게 묶인 토큰 등) 즉시 교체.
    // useSocket 의 리스너보다 먼저 붙어야 첫 응답을 놓치지 않는다.
    socket.on('session:new', ({ token }) => {
      if (token) replaceSessionToken(token);
    });

    /*
      인증이 안 붙은 채로 붙었다고 서버가 알려 온 경우. access_token 갱신이 한 번
      실패하면 그 연결은 게스트가 되는데, 그대로 두면 진행 중이던 판이 있는 사람은
      대기 화면에 갇힌다. 토큰을 다시 받아(여기서 Supabase 가 갱신을 마친다) 새로
      붙는다 — auth 콜백이 매 시도마다 최신 토큰을 싣기 때문에 이 한 번으로 붙는다.

      갱신이 계속 실패하면 무한 재연결이 되므로 최소 간격을 둔다. 정말 비로그인인
      상태(토큰이 끝내 없음)면 재연결하지 않고 게스트로 남는다.
    */
    socket.on('session:reauth', () => {
      const now = Date.now();
      if (now - lastReauthAt < REAUTH_MIN_INTERVAL_MS) return;
      lastReauthAt = now;
      void getCurrentAccessToken().then((accessToken) => {
        if (!accessToken || !socket) return;
        socket.disconnect();
        socket.connect();
      });
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
    // 토큰은 auth 콜백(getSocket)에서 매 시도마다 새로 읽는다.
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
