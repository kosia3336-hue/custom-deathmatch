'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ESKIMO_BEAR } from '@/shared/types/eskimo';
import styles from './eskimo-piece.module.css';

type TokenTone = 'primary' | 'highlight' | 'bear';

const TOKEN_IMAGES: Record<TokenTone, string> = {
  primary: '/games/eskimo/tokens/rifle-pink-v2.webp',
  highlight: '/games/eskimo/tokens/rifle-navy-v2.webp',
  bear: '/games/eskimo/tokens/polar-bear-v2.webp',
};

/** 생성된 이미지 한 벌을 판·범례·이동 미리보기에서 공유한다. */
function TokenArtwork({ tone }: { tone: TokenTone }) {
  return (
    <Image
      src={TOKEN_IMAGES[tone]}
      width={256}
      height={256}
      alt=""
      aria-hidden="true"
      draggable={false}
      unoptimized
      className={styles.artwork}
    />
  );
}

/** 선은 핑크, 후는 네이비 소총. 중립 북극곰은 흰 실루엣 토큰으로 구분한다. */
export function EskimoPiece({
  piece,
  firstPlayerId,
  ghost = false,
  className,
}: {
  piece: string;
  firstPlayerId: string;
  ghost?: boolean;
  className?: string;
}) {
  const tone = piece === ESKIMO_BEAR ? 'bear' : piece === firstPlayerId ? 'primary' : 'highlight';
  return (
    <span
      className={cn(
        'pointer-events-none absolute top-1/2 left-1/2 block h-[80%] w-[74%] -translate-x-1/2 -translate-y-1/2',
        ghost && 'opacity-50',
        className,
      )}
      aria-hidden
    >
      <TokenArtwork tone={tone} />
    </span>
  );
}

export function EskimoMarker({ tone }: { tone: TokenTone }) {
  return (
    <span className="block h-5 w-5 shrink-0" aria-hidden="true">
      <TokenArtwork tone={tone} />
    </span>
  );
}
