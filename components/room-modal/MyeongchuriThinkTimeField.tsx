'use client';

import { OptionButton, SettingField } from '@/components/room-modal/RoomModalKit';
import { MYEONGCHURI_DEFAULT_THINK_SECONDS } from '@/shared/types/myeongchuri';

const PRESETS = [60, 120, 180, 300];

/**
 * 명추리 '생각 시간' — 라운드 결과가 나온 뒤 다음 라운드 전에 두는 시간.
 * 방 만들기·방 설정이 같이 쓴다. 기본 켜짐·2분.
 */
export default function MyeongchuriThinkTimeField({
  enabled,
  seconds,
  onEnabledChange,
  onSecondsChange,
}: {
  enabled: boolean;
  seconds: number;
  onEnabledChange: (enabled: boolean) => void;
  onSecondsChange: (seconds: number) => void;
}) {
  return (
    <SettingField label="생각 시간" hint={`(기본 켜짐 · ${MYEONGCHURI_DEFAULT_THINK_SECONDS / 60}분)`}>
      <div className="flex flex-wrap gap-1.5">
        <OptionButton size="sm" active={enabled} onClick={() => onEnabledChange(true)}>
          켜기
        </OptionButton>
        <OptionButton size="sm" active={!enabled} onClick={() => onEnabledChange(false)}>
          끄기
        </OptionButton>
      </div>
      {enabled && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((value) => (
            <OptionButton key={value} size="sm" active={seconds === value} onClick={() => onSecondsChange(value)}>
              {value / 60}분
            </OptionButton>
          ))}
        </div>
      )}
      <p className="text-cdm-fg-subtle mt-2 text-xs">
        결과가 나온 뒤 다음 라운드 전에 생각할 시간입니다. 두 사람이 모두 건너뛰기를 누르면 바로 넘어갑니다.
      </p>
    </SettingField>
  );
}
