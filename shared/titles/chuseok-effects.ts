import type { TitleEffectKey } from './resolve-badge';

/** 2026 한가위 이펙트. DB 시드 전에도 CSS·뱃지 렌더가 이 목록을 쓴다. */
export const CHUSEOK_TITLE_EFFECTS = [
  { key: 'bokjumeoni', name: '복주머니', blurb: '주머니가 팡 터지며 칭호 이름이 나오고, 금은보화가 흩어진다.' },
  { key: 'hanji', name: '한지', blurb: '한지 위에 모필로 먹 글씨를 쓴다.' },
  { key: 'daltokki', name: '달토끼', blurb: '뱃지가 달이고, 토끼가 그 위를 깡총깡총 뛴다.' },
  { key: 'nakyeop', name: '가을낙엽', blurb: '단풍과 은행이 살랑살랑, 한 장씩 어긋나서 계속 떨어진다.' },
  { key: 'fullmoon', name: '풍요한가위', blurb: '명패 뒤에 보름달이 빛나고, 초승달이 스친 뒤 송편이 떨어진다.' },
] as const satisfies ReadonlyArray<{
  key: TitleEffectKey;
  name: string;
  blurb: string;
}>;

export type ChuseokTitleEffectKey = (typeof CHUSEOK_TITLE_EFFECTS)[number]['key'];
