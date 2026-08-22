'use client';

import type { AbstractAiDifficulty } from '@/shared/types';
import { OptionButton, SettingField } from './RoomModalKit';

export default function AbstractAiDifficultyField({
  value,
  onChange,
}: {
  value: AbstractAiDifficulty;
  onChange: (value: AbstractAiDifficulty) => void;
}) {
  return (
    <SettingField label="AI 난이도" hint="(기본 보통)">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <OptionButton active={value === 'normal'} onClick={() => onChange('normal')}>
            보통
          </OptionButton>
          <OptionButton active={value === 'hard'} onClick={() => onChange('hard')}>
            어려움
          </OptionButton>
        </div>
        {value === 'hard' && (
          <p className="text-cdm-fg-muted text-xs font-medium">
            상대가 더 오래 생각하며, 실수하지 않습니다.
          </p>
        )}
      </div>
    </SettingField>
  );
}
