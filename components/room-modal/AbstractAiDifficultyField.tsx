'use client';

import type { AbstractAiDifficulty } from '@/shared/types';
import { PAUSED_HARD_AI_GAME_IDS } from '@/shared/types/game';
import { OptionButton, SettingField } from './RoomModalKit';

export default function AbstractAiDifficultyField({
  value,
  onChange,
  gameId,
}: {
  value: AbstractAiDifficulty;
  onChange: (value: AbstractAiDifficulty) => void;
  gameId: string;
}) {
  const paused = PAUSED_HARD_AI_GAME_IDS.includes(gameId);
  return (
    <SettingField label="AI 난이도" hint="(기본 보통)">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <OptionButton active={paused || value === 'normal'} onClick={() => onChange('normal')}>
            보통
          </OptionButton>
          <OptionButton disabled={paused} active={!paused && value === 'hard'} onClick={() => onChange('hard')}>
            {paused ? '어려움 (일시 중지)' : '어려움'}
          </OptionButton>
        </div>
        {!paused && value === 'hard' && (
          <p className="text-cdm-fg-muted text-xs font-medium">
            상대가 더 오래 생각하며, 실수하지 않습니다.
          </p>
        )}
      </div>
    </SettingField>
  );
}
