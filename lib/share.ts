/**
 * 공유 시트 열기 — 카톡·인스타 DM·메일·문자 등 기기에 깔린 앱 중에서 고른다.
 *
 * 1. 앱(1.0.3~): 네이티브 공유 플러그인(@capacitor/share). 앱 웹뷰는 navigator.share 가 없다.
 * 2. 브라우저: Web Share API.
 * 3. 둘 다 안 되면(PC 파이어폭스, 이전 앱 빌드 등) 글과 링크를 클립보드에 복사.
 *
 * navigator.share 는 사용자 클릭 직후에만 열리므로 클릭 핸들러에서 await 없이 곧바로 부른다.
 */
import { getSharePlugin, type SharePlugin } from './native/bridge';

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

/** shared: 공유 시트로 보냄 · cancelled: 사용자가 시트를 닫음 · copied: 복사로 대신함 · failed: 전부 실패 */
export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed';

export interface ShareTargets {
  native: SharePlugin | null;
  web: Pick<Navigator, 'share'> & Partial<Pick<Navigator, 'canShare'>> | null;
  clipboard: Pick<Clipboard, 'writeText'> | null;
}

function defaultTargets(): ShareTargets {
  if (typeof navigator === 'undefined') return { native: null, web: null, clipboard: null };
  return {
    native: getSharePlugin(),
    web: typeof navigator.share === 'function' ? navigator : null,
    clipboard: navigator.clipboard ?? null,
  };
}

/** 브라우저는 AbortError, 네이티브 플러그인은 'Share canceled' 로 거절한다. */
function isCancel(error: unknown): boolean {
  if ((error as { name?: unknown } | null)?.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel/i.test(message);
}

export async function shareOrCopy(
  payload: SharePayload,
  targets: ShareTargets = defaultTargets(),
): Promise<ShareOutcome> {
  // 링크를 url 로 따로 넘기면 카톡 등이 글과 링크를 메시지 두 개로 보낸다.
  // 글 끝에 붙여 한 덩어리로 넘긴다(링크 미리보기는 글 속 주소로도 뜬다).
  const message = [payload.text, payload.url].filter(Boolean).join('\n');
  const data = { title: payload.title, text: message };
  if (targets.native) {
    try {
      await targets.native.share({ ...data, dialogTitle: '공유하기' });
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
    }
  } else if (targets.web && (!targets.web.canShare || targets.web.canShare(data))) {
    try {
      await targets.web.share(data);
      return 'shared';
    } catch (error) {
      if (isCancel(error)) return 'cancelled';
    }
  }
  if (!targets.clipboard) return 'failed';
  try {
    await targets.clipboard.writeText(message);
    return 'copied';
  } catch {
    return 'failed';
  }
}
