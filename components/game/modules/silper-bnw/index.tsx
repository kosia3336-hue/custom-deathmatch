'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS as GAME } from '@/shared/types/game';
import type { SBNWGameData } from '@/shared/types/silper-bnw';
import SilperBnwView from './SilperBnwView';

export default function SilperBnwGame() {
  const { sendAction, ...props } = useGameModuleConnection<SBNWGameData>(GAME.SILPER_BNW);
  return (
    <GameActionProvider send={sendAction}>
      <SilperBnwView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
