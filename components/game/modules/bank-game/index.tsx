'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import type { BankGameData } from '@/shared/types/bank-game';
import { GAME_IDS } from '@/shared/types/game';
import BankView from './BankView';
export default function BankGame() {
  const { sendAction, ...props } = useGameModuleConnection<BankGameData>(GAME_IDS.BANK_GAME);
  return (
    <GameActionProvider send={sendAction}>
      <BankView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
