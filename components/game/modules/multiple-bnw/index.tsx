'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS as GAME } from '@/shared/types/game';
import type { MultipleBnwGameData } from '@/shared/types/multiple-bnw';
import MultipleBnwView from './MultipleBnwView';

export default function MultipleBnwGame() {
  const { sendAction, ...props } = useGameModuleConnection<MultipleBnwGameData>(GAME.MULTIPLE_BNW);
  return (
    <GameActionProvider send={sendAction}>
      <MultipleBnwView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
