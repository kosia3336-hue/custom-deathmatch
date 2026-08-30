'use client';

import { useSyncExternalStore } from 'react';
import { useBgm } from '@/components/providers/BgmProvider';
import { isSfxMuted, setSfxMuted, subscribeSfxMuted } from '@/lib/sfxSettings';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

interface Props {
  className?: string;
}

/**
 * 상단 바의 소리 버튼 — 배경음악과 효과음을 함께 끄고 켠다.
 *
 * 둘 중 하나라도 켜져 있으면 '켜짐' 으로 보고, 누르면 둘 다 끈다.
 * 다시 누르면 둘 다 켠다. 개별 조절은 마이페이지 > 설정에서 한다.
 *
 * BGM 트랙이 없어도 버튼을 숨기지 않는다 — 효과음은 여전히 조절 대상이다.
 */
export function BgmButton({ className }: Props) {
  const { muted: bgmMuted, setMuted: setBgmMuted } = useBgm();
  const sfxMuted = useSyncExternalStore(subscribeSfxMuted, isSfxMuted, () => false);

  const soundOn = !bgmMuted || !sfxMuted;

  const toggle = () => {
    const nextMuted = soundOn;
    setBgmMuted(nextMuted);
    setSfxMuted(nextMuted);
  };

  const label = soundOn ? '소리 끄기 (배경음악·효과음)' : '소리 켜기 (배경음악·효과음)';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={soundOn}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-cdm-md text-cdm-fg-muted transition-colors hover:bg-cdm-bg-elev-1 hover:text-cdm-fg',
        className,
      )}
    >
      {soundOn ? <Icon name="soundOn" /> : <Icon name="soundOff" />}
    </button>
  );
}

