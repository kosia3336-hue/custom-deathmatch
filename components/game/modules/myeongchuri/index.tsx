'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { MyeongchuriGameData } from '@/shared/types/myeongchuri';
import MyeongchuriView from './MyeongchuriView';

export default function MyeongchuriGame() {
  const { sendAction, ...props } = useGameModuleConnection<MyeongchuriGameData>(
    GAME_IDS.MYEONGCHURI,
  );
  return (
    <GameActionProvider send={sendAction}>
      <MyeongchuriView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
