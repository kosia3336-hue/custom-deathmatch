/**
 * 공유 시트 열기 — 카톡·인스타·메일·문자 등 기기에 깔린 앱 중에서 고른다.
 *
 * 글·링크(`shareOrCopy`, 방 초대 등)
 * 1. 앱(1.0.3~): 네이티브 공유 플러그인(@capacitor/share). 앱 웹뷰는 navigator.share 가 없다.
 * 2. 브라우저: Web Share API.
 * 3. 둘 다 안 되면(PC 파이어폭스, 이전 앱 빌드 등) 클립보드에 복사.
 *
 * 이미지(`shareImageOrText`, 전적 결과 카드)
 * 1. 앱(1.0.4~): 앱 캐시에 PNG 를 쓰고(@capacitor/filesystem) 그 파일을 네이티브 공유.
 * 2. 브라우저: 파일을 받는 Web Share(모바일 크롬·사파리 등).
 * 3. 브라우저에서 파일 공유가 안 되면 이미지를 클립보드에 복사(붙여넣기로 보낼 수 있다).
 * 4. 그래도 안 되면(이전 앱 빌드 포함) 위 글 공유로 대신한다.
 *
 * navigator.share 는 사용자 클릭 직후에만 열리므로 클릭 핸들러에서 바로 부른다.
 */
import {
  getFilesystemPlugin,
  getSharePlugin,
  type FilesystemPlugin,
  type SharePlugin,
} from './native/bridge';

export interface SharePayload {
  title: string;
  text?: string;
  url?: string;
}

/**
 * shared: 공유 시트로 보냄 · cancelled: 사용자가 시트를 닫음 · copied: 글을 복사로 대신함 ·
 * copied-image: 이미지를 복사로 대신함 · failed: 전부 실패
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'copied-image' | 'failed';

export interface ShareTargets {
  native: SharePlugin | null;
  web: Pick<Navigator, 'share'> & Partial<Pick<Navigator, 'canShare'>> | null;
  clipboard: Pick<Clipboard, 'writeText'> | null;
}

export interface ImageShareTargets extends ShareTargets {
  files: FilesystemPlugin | null;
  imageClipboard: Pick<Clipboard, 'write'> | null;
  makeClipboardItem: ((blob: Blob) => ClipboardItem) | null;
}

function defaultTargets(): ImageShareTargets {
  if (typeof navigator === 'undefined') {
    return { native: null, web: null, clipboard: null, files: null, imageClipboard: null, makeClipboardItem: null };
  }
  const clipboard = navigator.clipboard ?? null;
  return {
    native: getSharePlugin(),
    web: typeof navigator.share === 'function' ? navigator : null,
    clipboard,
    files: getFilesystemPlugin(),
    imageClipboard: clipboard && typeof clipboard.write === 'function' ? clipboard : null,
    makeClipboardItem:
      typeof ClipboardItem === 'function' ? (blob) => new ClipboardItem({ [blob.type]: blob }) : null,
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

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * 이미지 한 장만 보낸다(글을 같이 넘기면 카톡 등이 메시지 두 개로 나눈다).
 * 이미지를 못 만들었거나 어디서도 이미지를 못 보내면 `fallback` 글로 공유한다.
 */
export async function shareImageOrText(
  file: File | null,
  fallback: SharePayload,
  targets: ImageShareTargets = defaultTargets(),
): Promise<ShareOutcome> {
  if (file) {
    if (targets.native) {
      if (targets.files) {
        try {
          const { uri } = await targets.files.writeFile({
            path: file.name,
            data: await toBase64(file),
            directory: 'CACHE',
          });
          await targets.native.share({ files: [uri], dialogTitle: '공유하기' });
          return 'shared';
        } catch (error) {
          if (isCancel(error)) return 'cancelled';
        }
      }
    } else {
      if (targets.web?.canShare?.({ files: [file] })) {
        try {
          await targets.web.share({ files: [file] });
          return 'shared';
        } catch (error) {
          if (isCancel(error)) return 'cancelled';
        }
      }
      if (targets.imageClipboard && targets.makeClipboardItem) {
        try {
          await targets.imageClipboard.write([targets.makeClipboardItem(file)]);
          return 'copied-image';
        } catch {
          // 글 공유로
        }
      }
    }
  }
  return shareOrCopy(fallback, targets);
}
