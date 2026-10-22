'use client';
import {
  LOOP_CHECK_BEST_OF,
  type LoopCheckBestOf,
  type LoopCheckColorMode,
} from '@/shared/types/loop-check';
import { OptionButton, SettingField } from './RoomModalKit';

export default function LoopCheckOptionsField({
  bestOf,
  colorMode,
  onBestOfChange,
  onColorModeChange,
}: {
  bestOf: LoopCheckBestOf;
  colorMode: LoopCheckColorMode;
  onBestOfChange: (value: LoopCheckBestOf) => void;
  onColorModeChange: (value: LoopCheckColorMode) => void;
}) {
  return (
    <>
      <SettingField label="경기 방식" hint="(기본 5전 3선승)">
        <div className="flex flex-wrap gap-2">
          {LOOP_CHECK_BEST_OF.map((count) => (
            <OptionButton
              key={count}
              active={bestOf === count}
              onClick={() => onBestOfChange(count)}
            >
              {count}전 {Math.floor(count / 2) + 1}선승
            </OptionButton>
          ))}
        </div>
      </SettingField>
      <SettingField label="색상 모드">
        <div className="flex gap-2">
          <OptionButton
            active={colorMode === 'standard'}
            onClick={() => onColorModeChange('standard')}
          >
            기본
          </OptionButton>
          <OptionButton
            active={colorMode === 'colorblind'}
            onClick={() => onColorModeChange('colorblind')}
          >
            색약 모드
          </OptionButton>
        </div>
        {colorMode === 'colorblind' && (
          <p className="text-cdm-fg-subtle mt-2 text-xs">
            고대비 색상과 고유 기호를 함께 표시합니다.
          </p>
        )}
      </SettingField>
    </>
  );
}
