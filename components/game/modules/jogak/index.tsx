'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { JogakGameData } from '@/shared/types/jogak';
import JogakView from './JogakView';

export default function JogakGame() {
  const { sendAction, ...props } = useGameModuleConnection<JogakGameData>(GAME_IDS.JOGAK);
  return (
    <GameActionProvider send={sendAction}>
      <JogakView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
