'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS as GAME } from '@/shared/types/game';
import { type QuatroGameData } from '@/shared/types/quatro';
import QuatroView from './QuatroView';

export default function QuatroGame() {
  const { sendAction, ...props } = useGameModuleConnection<QuatroGameData>(GAME.QUATRO);
  return (
    <GameActionProvider send={sendAction}>
      <QuatroView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
