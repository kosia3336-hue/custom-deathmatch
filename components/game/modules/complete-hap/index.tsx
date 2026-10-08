'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { CompleteHapGameData } from '@/shared/types/complete-hap';
import CompleteHapView from './CompleteHapView';

export default function CompleteHapGame() {
  const { sendAction, ...props } = useGameModuleConnection<CompleteHapGameData>(
    GAME_IDS.COMPLETE_HAP,
  );
  return (
    <GameActionProvider send={sendAction}>
      <CompleteHapView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
