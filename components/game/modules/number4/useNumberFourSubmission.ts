'use client';
import { useState } from 'react';
import type {
  NF4Number,
  NF4PlayerInfo,
  NF4TutorialHint,
  NumberFourAction,
} from '@/shared/types/number4';
import { TILES_PER_ROUND } from '@/shared/types/number4';
import { numberFourTileBounds, validateNumberFourSubmission } from '@/shared/numberFourSubmission';

export function useNumberFourSubmission(
  player: NF4PlayerInfo,
  tutorial: NF4TutorialHint | undefined,
  spectator: boolean,
  onAction: (action: NumberFourAction) => void,
) {
  const { minWhite, maxWhite, initialWhite } = numberFourTileBounds(player);
  const [white, setWhite] = useState(initialWhite);
  const [selectedNumber, setSelectedNumber] = useState<NF4Number | null>(null);
  const black = TILES_PER_ROUND - white;
  const check = validateNumberFourSubmission(white, black, selectedNumber, player);
  const isValid =
    !spectator &&
    check.ok &&
    (!tutorial || (white === tutorial.expectedWhite && selectedNumber === tutorial.expectedNumber));
  const handleSubmit = () => {
    if (isValid && check.ok) onAction({ type: 'submit', ...check.submission });
  };
  return {
    white,
    black,
    setWhite,
    selectedNumber,
    setSelectedNumber,
    minWhite,
    maxWhite,
    tileChoiceFixed: minWhite === maxWhite,
    isValid,
    handleSubmit,
  };
}
