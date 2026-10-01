'use client';

import { useSyncExternalStore } from 'react';
import { useBgm } from '@/components/providers/BgmProvider';
import {
  getSfxVolume,
  isSfxMuted,
  setSfxMuted,
  setSfxVolume,
  subscribeSfxSettings,
} from '@/lib/sfxSettings';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { Slider } from './Slider';

interface Props {
  /** 항목 아래에 한 줄 설명을 붙인다 (마이페이지 설정 탭) */
  hints?: boolean;
  className?: string;
}

/**
 * 소리 설정 — 효과음·배경음악 음량을 0~100% 로 조절한다.
 *
 * 인게임 설정 시트(GameShell)와 마이페이지 설정 탭이 이 하나를 같이 쓴다.
 * 줄마다 [음소거 버튼] [슬라이더] 로, 켜고 끄기와 크기 조절을 한자리에서 한다.
 * 슬라이더를 0 으로 내리면 음소거로 보고 직전 음량은 그대로 둔다 — 다시 켜면
 * 그 크기로 돌아온다(사실상 0 이면 저장소가 기본 음량으로 되돌린다).
 */
export function SoundSettings({ hints = false, className }: Props) {
  const bgm = useBgm();
  const sfxMuted = useSyncExternalStore(subscribeSfxSettings, isSfxMuted, () => false);
  const sfxVolume = useSyncExternalStore(subscribeSfxSettings, getSfxVolume, () => 1);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <SoundLevel
        label="효과음 (SFX)"
        hint={hints ? '게임·스킨 효과음 (배경음악과 별개)' : undefined}
        muted={sfxMuted}
        volume={sfxVolume}
        onMutedChange={setSfxMuted}
        onVolumeChange={setSfxVolume}
      />
      {/* 트랙이 없으면 조절할 대상이 없다 */}
      {bgm.hasTracks && (
        <SoundLevel
          label="배경음악 (BGM)"
          hint={hints ? '사이트에서 흘러나오는 배경음악' : undefined}
          muted={bgm.muted}
          volume={bgm.volume}
          onMutedChange={bgm.setMuted}
          onVolumeChange={bgm.setVolume}
        />
      )}
    </div>
  );
}

function SoundLevel({
  label,
  hint,
  muted,
  volume,
  onMutedChange,
  onVolumeChange,
}: {
  label: string;
  hint?: string;
  muted: boolean;
  volume: number;
  onMutedChange: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
}) {
  const pct = muted ? 0 : Math.round(volume * 100);

  return (
    <div>
      <p className="text-sm font-medium text-cdm-fg">{label}</p>
      {hint && <p className="text-xs text-cdm-fg-muted">{hint}</p>}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onMutedChange(!muted)}
          aria-pressed={!muted}
          aria-label={muted ? `${label} 켜기` : `${label} 끄기`}
          title={muted ? '켜기' : '끄기'}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-cdm-md text-cdm-fg-muted transition-colors hover:bg-cdm-bg-elev-1 hover:text-cdm-fg"
        >
          <Icon name={muted ? 'soundOff' : 'soundOn'} />
        </button>
        <Slider
          className="flex-1"
          value={pct}
          ariaLabel={`${label} 음량`}
          valueLabel={pct === 0 ? '꺼짐' : `${pct}%`}
          onChange={(next) => {
            if (next === 0) {
              onMutedChange(true);
              return;
            }
            onVolumeChange(next / 100);
            if (muted) onMutedChange(false);
          }}
        />
      </div>
    </div>
  );
}
