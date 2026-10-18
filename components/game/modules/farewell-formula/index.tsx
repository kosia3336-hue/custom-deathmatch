'use client';

import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { FarewellFormulaGameData } from '@/shared/types/farewell-formula';
import FarewellFormulaView from './FarewellFormulaView';

export default function FarewellFormulaGame() {
  const { sendAction, ...props } = useGameModuleConnection<FarewellFormulaGameData>(
    GAME_IDS.FAREWELL_FORMULA,
  );
  return (
    <GameActionProvider send={sendAction}>
      <FarewellFormulaView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
