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

export interface SharePlugin {
  share: (options: {
    title?: string;
    text?: string;
    url?: string;
    /** file:// 주소(앱 캐시 등). 이미지 공유에 쓴다 */
    files?: string[];
    dialogTitle?: string;
  }) => Promise<{ activityType?: string }>;
}

/** @capacitor/filesystem — 공유할 이미지를 앱 캐시에 써 두는 데만 쓴다 */
export interface FilesystemPlugin {
  writeFile: (options: {
    path: string;
    /** base64 */
    data: string;
    /** Directory.Cache 의 값 */
    directory: 'CACHE';
  }) => Promise<{ uri: string }>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: {
    PushNotifications?: PushNotificationsPlugin;
    Share?: SharePlugin;
    Filesystem?: FilesystemPlugin;
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

/** 앱이 아니거나 공유 플러그인이 없는 이전 앱 빌드(~1.0.2)면 null. */
export function getSharePlugin(): SharePlugin | null {
  if (!isNativeApp()) return null;
  return getCapacitor()?.Plugins?.Share ?? null;
}

/** 앱이 아니거나 파일 플러그인이 없는 이전 앱 빌드(~1.0.3)면 null — 이미지 대신 글로 공유한다. */
export function getFilesystemPlugin(): FilesystemPlugin | null {
  if (!isNativeApp()) return null;
  const cap = getCapacitor();
  if (cap?.isPluginAvailable && !cap.isPluginAvailable('Filesystem')) return null;
  return cap?.Plugins?.Filesystem ?? null;
}
