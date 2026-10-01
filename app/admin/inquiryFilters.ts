export const INQUIRY_STATUS_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '미처리' },
  { value: 'done', label: '처리완료' },
] as const;

export type InquiryStatusFilter = (typeof INQUIRY_STATUS_FILTERS)[number]['value'];
export type InquiryCategoryFilter = 'all' | string;

export function parseInquiryStatusFilter(raw: string | undefined): InquiryStatusFilter {
  if (raw === 'pending' || raw === 'done') return raw;
  return 'all';
}

export function parseInquiryCategoryFilter(
  raw: string | undefined,
  knownSlugs: string[],
): InquiryCategoryFilter {
  if (raw && knownSlugs.includes(raw)) return raw;
  return 'all';
}
