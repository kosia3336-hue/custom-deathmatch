/**
 * 룰 이미지 주소 → 우리 서버를 거치는 주소.
 *
 * 룰 이미지는 Supabase 저장소(rule-images 버킷)에 있다. 브라우저가 그 주소를 바로 받으면
 * 룰 페이지·소개 페이지·룰 창을 볼 때마다 Supabase 전송량이 나간다(2026-10-24 무료 한도 초과).
 * /api/rule-image 가 처음 한 번만 받아 디스크에 두고, 브라우저에도 오래 캐시시킨다.
 * 저장소 주소가 아니면(로컬 경로 등) 그대로 둔다.
 */
export const RULE_IMAGE_BUCKET = 'rule-images';

export function ruleImageStoragePrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base.replace(/\/$/, '')}/storage/v1/object/public/${RULE_IMAGE_BUCKET}/` : null;
}

export function ruleImageSrc(url: string): string;
export function ruleImageSrc(url: string | undefined): string | undefined;
export function ruleImageSrc(url: string | undefined): string | undefined {
  if (!url) return url;
  const prefix = ruleImageStoragePrefix();
  if (!prefix || !url.startsWith(prefix)) return url;
  return `/api/rule-image?src=${encodeURIComponent(url)}`;
}
