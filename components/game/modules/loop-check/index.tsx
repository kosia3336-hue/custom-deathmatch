'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { LoopCheckGameData } from '@/shared/types/loop-check';
import LoopCheckView from './LoopCheckView';

export default function LoopCheckGame() {
  const { sendAction, ...props } = useGameModuleConnection<LoopCheckGameData>(GAME_IDS.LOOP_CHECK);
  return (
    <GameActionProvider send={sendAction}>
      <LoopCheckView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
