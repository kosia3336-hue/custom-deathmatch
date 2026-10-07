'use client';

export function labelOfItem(kind: string): string {
  if (kind === 'info') return '정보';
  if (kind === 'zero') return '제로';
  if (kind === 'secret') return '시크릿';
  return kind;
}
