/**
 * 시드섯다 덱 — 클라이언트·서버 공용.
 *
 * 서버만 알고 있으면 화면에서 '스무 장 전부' 를 그릴 수 없어, 같은 목록을 화면에
 * 또 적어야 한다. 그러면 한쪽이 바뀔 때 조용히 어긋난다. 그래서 여기 한 곳에 둔다.
 */
import type {
  SeedSeotdaCard,
  SeedSeotdaCardKind,
  SeedSeotdaCardVariant,
  SeedSeotdaMonth,
} from '../types/seed-seotda';

/** 각 월의 첫 장(a)이 무슨 그림인지. 둘째 장(b)은 8월만 열끗이고 나머지는 띠다. */
const FIRST_CARD_KIND: Record<SeedSeotdaMonth, SeedSeotdaCardKind> = {
  1: 'bright',
  2: 'animal',
  3: 'bright',
  4: 'animal',
  5: 'animal',
  6: 'animal',
  7: 'animal',
  8: 'bright',
  9: 'animal',
  10: 'animal',
};

/** 1~10월 × 두 장 = 스무 장. 순서는 월, 그 안에서 a·b 다. */
export function createSeedSeotdaDeck(): SeedSeotdaCard[] {
  return Array.from({ length: 10 }, (_, index) => (index + 1) as SeedSeotdaMonth).flatMap((month) =>
    (['a', 'b'] as SeedSeotdaCardVariant[]).map((variant) => ({
      id: `${month}${variant}`,
      month,
      variant,
      kind: variant === 'a' ? FIRST_CARD_KIND[month] : month === 8 ? 'animal' : 'ribbon',
    })),
  );
}
