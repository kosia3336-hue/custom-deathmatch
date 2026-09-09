'use client';

import {
  MAX_ABSTRACT_AI_THINK_SECONDS,
  MIN_ABSTRACT_AI_THINK_SECONDS,
  formatAbstractAiThinkSeconds,
  resolveAbstractAiThinkSeconds,
} from '@/shared/types';
import { OptionButton, SettingField } from './RoomModalKit';

const PRESETS = [5, 15, 30, 60, 180] as const;
const SECOND_OPTIONS = [0, 5, 10, 15, 20, 30, 45];

export default function AbstractAiThinkTimeField({
  value,
  onChange,
}: {
  value: number;
  onChange: (seconds: number) => void;
}) {
  const clamped = resolveAbstractAiThinkSeconds({ aiThinkSeconds: value });
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;

  const setParts = (min: number, sec: number) => {
    onChange(resolveAbstractAiThinkSeconds({ aiThinkSeconds: min * 60 + sec }));
  };

  const secondChoices =
    minutes >= 3 ? [0] : minutes === 0 ? SECOND_OPTIONS.filter((s) => s >= MIN_ABSTRACT_AI_THINK_SECONDS) : SECOND_OPTIONS;

  return (
    <SettingField label="AI 고민 시간" hint={`(기본 5초, 최대 ${MAX_ABSTRACT_AI_THINK_SECONDS / 60}분)`}>
      <div className="flex items-center gap-2">
        <select
          value={minutes}
          onChange={(e) => {
            const min = Number(e.target.value);
            let sec = seconds;
            if (min >= 3) sec = 0;
            else if (min === 0 && sec < MIN_ABSTRACT_AI_THINK_SECONDS) sec = MIN_ABSTRACT_AI_THINK_SECONDS;
            setParts(min, sec);
          }}
          className="border-cdm-border focus:border-cdm-primary h-10 rounded-lg border px-3 text-sm focus:outline-none"
        >
          {[0, 1, 2, 3].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="text-cdm-fg-muted text-sm">분</span>
        <select
          value={secondChoices.includes(seconds) ? seconds : secondChoices[0]}
          onChange={(e) => setParts(minutes, Number(e.target.value))}
          className="border-cdm-border focus:border-cdm-primary h-10 rounded-lg border px-3 text-sm focus:outline-none"
        >
          {secondChoices.map((s) => (
            <option key={s} value={s}>
              {String(s).padStart(2, '0')}
            </option>
          ))}
        </select>
        <span className="text-cdm-fg-muted text-sm">초</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <OptionButton
            key={preset}
            size="sm"
            active={clamped === preset}
            onClick={() => onChange(preset)}
          >
            {formatAbstractAiThinkSeconds(preset)}
          </OptionButton>
        ))}
      </div>
      <p className="text-cdm-fg-muted mt-2 text-xs font-medium">
        이 시간 동안 최선수를 찾은 뒤 둡니다. 길수록 상대가 더 오래 생각합니다.
      </p>
    </SettingField>
  );
}
