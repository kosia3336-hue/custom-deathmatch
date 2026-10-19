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
      <p className="text-cdm-fg-subtle mt-2 text-xs">
        어려움에서는 제곱, 루트, 팩토리얼 기호가 등장합니다.
      </p>
    </SettingField>
  );
}
