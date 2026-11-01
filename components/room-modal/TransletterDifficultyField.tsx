'use client';

import type { TransletterDifficulty } from '@/shared/types';
import { OptionButton, SettingField } from './RoomModalKit';

export default function TransletterDifficultyField({
  value,
  onChange,
}: {
  value: TransletterDifficulty;
  onChange: (value: TransletterDifficulty) => void;
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
        <p className="text-cdm-fg-subtle mt-2 text-xs">
          자주 쓰이는 자모로 바뀌어 바뀐 글자를 찾기 어렵습니다
        </p>
      )}
    </SettingField>
  );
}
