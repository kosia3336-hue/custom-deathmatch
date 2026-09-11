import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import styles from './PlayingCard.module.css';

/*
  공용 숫자 카드 — 양면포커 · 인디언홀덤Q · 초이스 홀덤이 한 장의 스프라이트를 쓴다.

  public/games/cards/playing/cdm-playing-cards.webp (pnpm assets:playing-cards)
    0 ~ 9    앞면 1 ~ 10
    10 ~ 19  숫자가 적힌 뒷면 1 ~ 10 (양면포커)
    20       숫자 없는 뒷면 — 가려진 카드

  크기는 size 로 고르거나, 게임 판에 맞춰야 하면 size 없이 className 으로 너비를
  준다(높이는 5:7 비율로 따라온다).
*/

export type PlayingCardSize = 'tiny' | 'sm' | 'md' | 'lg';
export type PlayingCardFace = 'front' | 'back';

const COLUMNS = 6;
const ROWS = 4;
const PLAIN_BACK = 20;

function spriteIndex(value: number | null, face: PlayingCardFace, hidden: boolean) {
  if (hidden || value == null || !Number.isFinite(value)) return PLAIN_BACK;
  const safe = Math.trunc(value);
  if (safe < 1 || safe > 10) return PLAIN_BACK;
  return (face === 'back' ? 10 : 0) + safe - 1;
}

export default function PlayingCard({
  value,
  face = 'front',
  hidden = false,
  size,
  animateIn = false,
  decorative = false,
  className,
  ariaLabel,
}: {
  value: number | null;
  /** 'back' 은 숫자가 적힌 뒷면(양면포커). 가려진 카드는 hidden 으로 */
  face?: PlayingCardFace;
  /** 숫자 없는 뒷면. value 가 없어도 이 면이 나온다 */
  hidden?: boolean;
  size?: PlayingCardSize;
  /** 가려져 있던 카드가 공개될 때 한 번 튀어 오른다 */
  animateIn?: boolean;
  /** 이름을 이미 붙인 단추 안에 넣을 때 — 화면 읽기에서 두 번 읽히지 않게 */
  decorative?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const index = spriteIndex(value, face, hidden);
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  const isPlainBack = index === PLAIN_BACK;
  const style: CSSProperties = {
    backgroundPosition: `${(column / (COLUMNS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
  };
  const label = isPlainBack
    ? '카드 뒷면'
    : face === 'back'
      ? `뒷면 숫자 ${value}`
      : `숫자 ${value} 카드`;

  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': ariaLabel ?? label })}
      className={cn(styles.card, size && styles[size], animateIn && styles.revealing, className)}
      style={style}
      data-card-face={isPlainBack ? 'hidden' : face}
      data-card-value={isPlainBack ? undefined : value ?? undefined}
    />
  );
}
