import type { SMS2MarkId } from '@/shared/types/sun-moon-star-2';

export type DalmajiSky = 'dawn' | 'morning' | 'night';

/** 점등된 표식이 하늘을 정한다. 시작·달은 새벽. */
export function dalmajiSkyOf(mark: SMS2MarkId | null | undefined): DalmajiSky {
  if (mark === 'sun') return 'morning';
  if (mark === 'star') return 'night';
  return 'dawn';
}
