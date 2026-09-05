/**
 * 앱(Capacitor 웹뷰) 런타임 감지와 플러그인 접근.
 *
 * 앱은 이 사이트를 그대로 웹뷰에 띄우는 방식이라(mobile/README.md),
 * 브라우저와 앱이 **같은 번들**을 쓴다. 그래서 @capacitor/* 를 import 하지 않고
 * 웹뷰가 주입해 주는 window.Capacitor 전역만 사용한다.
 * 브라우저에서는 전역이 없으므로 모든 함수가 조용히 no-op 이 된다.
 */

interface PluginListenerHandle {
  remove: () => Promise<void>;
}

interface PermissionStatus {
  receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
}

interface PushNotificationsPlugin {
  checkPermissions: () => Promise<PermissionStatus>;
  requestPermissions: () => Promise<PermissionStatus>;
  register: () => Promise<void>;
  addListener: (
    event: string,
    handler: (payload: never) => void,
  ) => Promise<PluginListenerHandle>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    PushNotifications?: PushNotificationsPlugin;
    [name: string]: unknown;
  };
}

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** 앱 웹뷰에서 실행 중인지. 일반 브라우저면 false. */
export function isNativeApp(): boolean {
  return getCapacitor()?.isNativePlatform?.() === true;
}

/** 'android' | 'ios' | 'web' */
export function getNativePlatform(): string {
  return getCapacitor()?.getPlatform?.() ?? 'web';
}

/** 앱이 아니거나 플러그인이 없으면 null. */
export function getPushPlugin(): PushNotificationsPlugin | null {
  if (!isNativeApp()) return null;
  return getCapacitor()?.Plugins?.PushNotifications ?? null;
}
