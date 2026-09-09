import type { SupabaseClient } from '@supabase/supabase-js';

export const INQUIRY_ACCOUNT_SLUG = 'account';
export const INQUIRY_ETC_SLUG = 'etc';

export interface InquiryCategoryRow {
  slug: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export function inquiryCategoryLabel(slug: string, cats: InquiryCategoryRow[]): string {
  return cats.find((c) => c.slug === slug)?.label ?? slug;
}

export function pickSubmitCategory(reasonTag: string | null, cats: InquiryCategoryRow[]): string {
  const active = cats.filter((c) => c.is_active);
  const want =
    reasonTag === 'suspension' || reasonTag === 'ban' ? INQUIRY_ACCOUNT_SLUG : INQUIRY_ETC_SLUG;
  return active.find((c) => c.slug === want)?.slug ?? active[0]?.slug ?? '';
}

export async function fetchInquiryCategories(
  sb: SupabaseClient,
  opts?: { activeOnly?: boolean },
): Promise<InquiryCategoryRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (sb as any)
    .from('inquiry_categories')
    .select('slug, label, sort_order, is_active, is_system')
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true });
  if (opts?.activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as InquiryCategoryRow[];
}

export function mapInquiryError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes('Category inactive')) return '더 이상 받지 않는 분류입니다. 다른 분류를 골라 주세요.';
  if (m.includes('Unknown category')) return '알 수 없는 분류입니다.';
  if (m.includes('category_system')) return '계정/정지와 기타는 끌 수 없습니다.';
  if (m.includes('category_label_taken')) return '같은 이름의 분류가 있습니다.';
  if (m.includes('category_label_invalid')) return '분류 이름은 1~20자로 적어 주세요.';
  if (m.includes('category_unknown')) return '분류를 찾을 수 없습니다.';
  if (m.includes('Title length')) return '제목은 5~50자로 적어 주세요.';
  if (m.includes('Body length')) return '본문은 10~1000자로 적어 주세요.';
  return m;
}
