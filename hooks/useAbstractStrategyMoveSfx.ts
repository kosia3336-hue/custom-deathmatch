'use client';

import { useEffect, useRef } from 'react';
import { playAbstractStrategyMoveSfx } from '@/lib/abstractStrategySfx';
import { playSpringRainPlopSfx } from '@/lib/sfx';

type AbstractStrategyMoveSfxVariant = 'default' | 'spring-rain';

/**
 * 서버에서 받은 보드가 실제로 달라졌을 때만 이동음을 낸다.
 * 최초 입장 상태와 게임 사이의 빈 상태에는 소리를 내지 않는다.
 */
export function useAbstractStrategyMoveSfx(
  board: unknown,
  variant: AbstractStrategyMoveSfxVariant = 'default',
): void {
  const boardSignature = board == null ? null : JSON.stringify(board);
  const previousSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (boardSignature === null) {
      previousSignatureRef.current = null;
      return;
    }

    const previousSignature = previousSignatureRef.current;
    previousSignatureRef.current = boardSignature;

    if (previousSignature !== null && previousSignature !== boardSignature) {
      if (variant === 'spring-rain') playSpringRainPlopSfx();
      else playAbstractStrategyMoveSfx();
    }
  }, [boardSignature, variant]);
}
