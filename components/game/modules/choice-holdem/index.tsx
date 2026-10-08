'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { ChoiceHoldemGameData } from '@/shared/types/choice-holdem';
import ChoiceHoldemView from './ChoiceHoldemView';

export default function ChoiceHoldemGame() {
  const { sendAction, ...props } = useGameModuleConnection<ChoiceHoldemGameData>(
    GAME_IDS.CHOICE_HOLDEM,
  );
  return (
    <GameActionProvider send={sendAction}>
      <ChoiceHoldemView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
