'use client';

import type { NF4PlayerInfo, NumberFourAction, NF4TutorialHint } from '@/shared/types/number4';
import { TILES_PER_ROUND } from '@/shared/types/number4';
import type { SkinTheme } from '@/lib/skins/registry';
import { NUMBER_INFO } from './constants';
import styles from './number-four.module.css';
import { useNumberFourSubmission } from './useNumberFourSubmission';
import Button from '@/components/ui/Button';
import DualityFieldShell from './skins/DualityFieldShell';
import { DualityTileRow } from './skins/DualityTile';
import { TileQuantities } from './Presentation';
import DualityNumberCard from './skins/DualityNumberCard';

interface SubmitSelectorProps {
  player: NF4PlayerInfo;
  isSpectator: boolean;
  skin?: SkinTheme | null;
  onAction: (action: NumberFourAction) => void;
  tutorial?: NF4TutorialHint;
}

export default function SubmitSelector({
  player,
  isSpectator,
  skin,
  onAction,
  tutorial,
}: SubmitSelectorProps) {
  const {
    white,
    black,
    setWhite,
    selectedNumber,
    setSelectedNumber,
    minWhite,
    maxWhite,
    tileChoiceFixed,
    isValid,
    handleSubmit,
  } = useNumberFourSubmission(player, tutorial, isSpectator, onAction);

  const isDuality = skin === 'duality';

  const inner = (
    <>
      {/* 타일 선택 */}
      <div className="flex flex-col gap-2">
        <div data-tile-heading className="flex items-center justify-between">
          <span className={`${styles.secondaryText} text-xs font-semibold tracking-wide uppercase`}>
            타일
          </span>
          <span className={`${styles.mutedText} text-xs`}>
            보유 <TileQuantities white={player.remainingWhite} black={player.remainingBlack} />
          </span>
        </div>

        {tileChoiceFixed ? (
          <div className={`${styles.primaryText} flex items-center justify-center gap-4 text-sm`}>
            <span>
              백색 □ <strong>{white}</strong>
            </span>
            <span>
              흑색 ■ <strong>{black}</strong>
            </span>
            <span className={`${styles.mutedText} text-xs`}>(선택 불가)</span>
          </div>
        ) : (
          <div data-tile-controls className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className={`${styles.secondaryText} text-xs`}>백색 □</span>
              <div className="flex items-center gap-2">
                <button
                  aria-label="제출할 백색 감소"
                  onClick={() => setWhite((v) => Math.max(minWhite, v - 1))}
                  disabled={white <= minWhite}
                  className={`${styles.tileButton} flex h-8 w-8 items-center justify-center rounded-lg border text-lg font-bold transition disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  −
                </button>
                <span
                  className={`${styles.tileCount} ${styles.valueText} w-8 text-center text-xl font-bold`}
                >
                  {white}
                </span>
                <button
                  aria-label="제출할 백색 증가"
                  onClick={() => setWhite((v) => Math.min(maxWhite, v + 1))}
                  disabled={white >= maxWhite}
                  className={`${styles.tileButton} flex h-8 w-8 items-center justify-center rounded-lg border text-lg font-bold transition disabled:cursor-not-allowed disabled:opacity-30`}
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className={`${styles.secondaryText} text-xs`}>흑색 ■</span>
              <span className={`${styles.valueText} text-xl font-bold`}>{black}</span>
            </div>
          </div>
        )}

        {/* 타일 미리보기 */}
        {isDuality ? (
          <div data-tile-preview>
            <DualityTileRow white={white} total={TILES_PER_ROUND} />
          </div>
        ) : (
          <div data-tile-preview className="flex justify-center gap-1">
            {Array.from({ length: TILES_PER_ROUND }, (_, i) => (
              <div
                key={i}
                className={`h-7 w-7 rounded border-2 transition-colors ${
                  i < white ? 'border-gray-300 bg-white' : 'border-gray-600 bg-gray-800'
                }`}
              />
            ))}
          </div>
        )}

        <div data-tile-remainder className={`${styles.mutedText} text-center text-xs`}>
          제시 후 잔여:{' '}
          <TileQuantities
            white={player.remainingWhite - white}
            black={player.remainingBlack - black}
          />
        </div>
      </div>

      <div className={`${styles.divider} border-t`} />

      {/* 넘버 선택 */}
      <div className="flex flex-col gap-2">
        <span className={`${styles.secondaryText} text-xs font-semibold tracking-wide uppercase`}>
          넘버
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {NUMBER_INFO.map((info) => {
            const isSelected = selectedNumber === info.number;
            if (isDuality) {
              return (
                <DualityNumberCard
                  key={info.number}
                  number={info.number}
                  reward={info.reward}
                  condition={info.condition}
                  isSelected={isSelected}
                  onClick={() => setSelectedNumber(info.number)}
                />
              );
            }
            return (
              <button
                key={info.number}
                onClick={() => setSelectedNumber(info.number)}
                aria-pressed={isSelected}
                aria-label={`넘버 ${info.number}`}
                data-tutorial-target={tutorial?.expectedNumber === info.number || undefined}
                className={`${styles.numberChoice} flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <span className={styles.numberValue} style={{ color: info.color }}>
                  {info.number}
                </span>
                <span className="text-xs font-semibold" style={{ color: info.color }}>
                  +{info.reward}
                </span>
                <span className={styles.numberCondition}>{info.condition}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isDuality ? (
        <button
          onClick={handleSubmit}
          disabled={!isValid || isSpectator}
          className="skin-duality-submit-btn"
        >
          확인
        </button>
      ) : (
        <Button onClick={handleSubmit} disabled={!isValid || isSpectator}>
          확인
        </Button>
      )}
    </>
  );

  if (isDuality) {
    return <DualityFieldShell>{inner}</DualityFieldShell>;
  }

  return (
    <div
      data-number-four-selector
      className={`${styles.selector} flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4`}
    >
      {inner}
    </div>
  );
}
