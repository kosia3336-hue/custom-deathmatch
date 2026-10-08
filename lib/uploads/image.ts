import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 이미지 업로드 공통 검증.
 *
 * multipart 의 file.type 은 브라우저가 붙여 주는 값이라 위조할 수 있다.
 * 확장자·Content-Type 만 믿고 스토리지에 넣으면 실제로는 이미지가 아닌 파일이
 * 이미지 MIME 으로 공개 버킷에 올라간다. 시그니처(매직 바이트)까지 확인한다.
 */

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB

type ImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

const EXT_BY_TYPE: Record<ImageType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** 바이트 시그니처로 실제 이미지 형식을 판별. 알 수 없으면 null. */
function sniffImageType(buf: Buffer): ImageType | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // GIF: "GIF87a" / "GIF89a"
  if (buf.subarray(0, 6).toString('latin1') === 'GIF87a' || buf.subarray(0, 6).toString('latin1') === 'GIF89a') {
    return 'image/gif';
  }
  // WebP: "RIFF" .... "WEBP"
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export type ImageUploadResult =
  | { ok: true; buffer: Buffer; contentType: ImageType; ext: string }
  | { ok: false; error: string; status: 400 | 413 };

/**
 * multipart 요청에서 'file' 필드를 읽어 이미지인지 검증한다.
 * 본문을 메모리에 올리기 전에 Content-Length 로 먼저 걸러낸다.
 */
export async function readImageUpload(
  req: Request,
  maxBytes: number = IMAGE_MAX_BYTES,
): Promise<ImageUploadResult> {
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes * 2) {
    return { ok: false, error: '이미지는 5MB 이하만 가능합니다.', status: 413 };
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return { ok: false, error: '잘못된 요청입니다.', status: 400 };
  }
  if (!file) return { ok: false, error: '파일이 없습니다.', status: 400 };
  if (file.size > maxBytes) {
    return { ok: false, error: '이미지는 5MB 이하만 가능합니다.', status: 413 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    return { ok: false, error: '이미지는 5MB 이하만 가능합니다.', status: 413 };
  }

  const contentType = sniffImageType(buffer);
  if (!contentType) {
    return {
      ok: false,
      error: 'PNG/JPEG/WebP/GIF 이미지만 업로드할 수 있습니다.',
      status: 400,
    };
  }

  return { ok: true, buffer, contentType, ext: EXT_BY_TYPE[contentType] };
}

// ── 버킷 생성은 프로세스당 1회면 충분 ────────────────────────────────────────
// 업로드마다 createBucket 을 부르면 요청마다 스토리지 왕복이 한 번씩 더 붙는다.
const ensuredBuckets = new Set<string>();

export async function ensureBucketOnce(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>,
  bucket: string,
  fileSizeLimit: number = IMAGE_MAX_BYTES,
  /** 없을 때 새로 만들 버킷의 공개 여부. 이미 있는 버킷은 바꾸지 않는다. */
  isPublic = true,
): Promise<void> {
  if (ensuredBuckets.has(bucket)) return;
  try {
    await sb.storage.createBucket(bucket, { public: isPublic, fileSizeLimit });
  } catch {
    // 이미 존재 — 무시
  }
  ensuredBuckets.add(bucket);
}
