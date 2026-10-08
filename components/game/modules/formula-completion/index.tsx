'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import FormulaCompletionView from './FormulaCompletionView';

export default function FormulaCompletionGame() {
  const { sendAction, ...props } = useGameModuleConnection<FormulaCompletionGameData>(
    GAME_IDS.FORMULA_COMPLETION,
  );
  return (
    <GameActionProvider send={sendAction}>
      <FormulaCompletionView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
