'use client';

import { useSyncExternalStore } from 'react';
import { useBgm } from '@/components/providers/BgmProvider';
import {
  getSfxVolume,
  isSfxMuted,
  setSfxMuted,
  setSfxVolume,
  subscribeSfxMuted,
} from '@/lib/sfxSettings';

export function GameSoundSettings() {
  const bgm = useBgm();
  const muted = useSyncExternalStore(subscribeSfxMuted, isSfxMuted, () => false);
  const volume = useSyncExternalStore(subscribeSfxMuted, getSfxVolume, () => 1);
  return (
    <div className="space-y-4 py-3">
      <Volume
        label="효과음 (SFX)"
        value={muted ? 0 : volume}
        onChange={(v) => {
          setSfxVolume(v);
          setSfxMuted(v === 0);
        }}
      />
      <Volume
        label="배경음악"
        value={bgm.muted ? 0 : bgm.volume}
        onChange={(v) => {
          bgm.setVolume(v);
          bgm.setMuted(v === 0);
        }}
      />
    </div>
  );
}

function Volume({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-cdm-fg block text-sm">
      <span className="mb-2 flex justify-between">
        <span>{label}</span>
        <span className="text-cdm-fg-muted tabular-nums">
          {value === 0 ? '꺼짐' : `${Math.round(value * 100)}%`}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="accent-cdm-primary h-8 w-full cursor-pointer"
      />
    </label>
  );
}
