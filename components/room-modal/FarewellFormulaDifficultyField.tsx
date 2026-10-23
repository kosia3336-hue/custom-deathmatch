'use client';

import type { FarewellFormulaDifficulty } from '@/shared/types';
import { OptionButton, SettingField } from './RoomModalKit';

export default function FarewellFormulaDifficultyField({
  value,
  onChange,
}: {
  value: FarewellFormulaDifficulty;
  onChange: (value: FarewellFormulaDifficulty) => void;
}) {
  return (
    <SettingField label="문제 난이도" hint="(기본 보통)">
      <div className="flex gap-2">
        <OptionButton active={value === 'normal'} onClick={() => onChange('normal')}>
          보통
        </OptionButton>
        <OptionButton active={value === 'hard'} onClick={() => onChange('hard')}>
          어려움
        </OptionButton>
      </div>
      {value === 'hard' && (
        <p className="text-cdm-fg-subtle mt-2 text-xs">특수 기호(^,!,루트) 사용될 수 있습니다</p>
      )}
    </SettingField>
  );
}
