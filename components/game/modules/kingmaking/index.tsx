'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { KingmakingGameData } from '@/shared/types/kingmaking';
import KingmakingView from './KingmakingView';

export default function KingmakingGame() {
  const { sendAction, ...props } = useGameModuleConnection<KingmakingGameData>(GAME_IDS.KINGMAKING);
  return (
    <GameActionProvider send={sendAction}>
      <KingmakingView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
