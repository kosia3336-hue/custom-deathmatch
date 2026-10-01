export type LogOpponentFilter = 'all' | 'user' | 'ai';

export function parseLogOpponentFilter(value: string | undefined): LogOpponentFilter {
  if (value === 'user' || value === 'ai') return value;
  return 'all';
}
