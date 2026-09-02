'use client';

/* 임시 확인용 화면. 커밋 전에 지운다. /room/x/uipreview?g=game-001 */
import { useEffect, useState, type ComponentType } from 'react';
import { useSearchParams } from 'next/navigation';
import GameShell from '@/components/game/GameShell';
import { useRoomStore } from '@/stores/room';
import { GAME_IDS } from '@/shared/types';

import FourGravityGame from '@/components/game/modules/four-gravity';
import DoubleSidedChessGame from '@/components/game/modules/double-sided-chess';
import NumberFourGame from '@/components/game/modules/number4';
import IndianPokerGame from '@/components/game/modules/indian-poker';
import InvestDonateGame from '@/components/game/modules/invest-donate';
import BettingRpsGame from '@/components/game/modules/betting-rps';
import QuatroGame from '@/components/game/modules/quatro';
import WordPuzzleGame from '@/components/game/modules/word-puzzle';
import TransletterGame from '@/components/game/modules/transletter';
import FormulaCompletionGame from '@/components/game/modules/formula-completion';
import CompleteHapGame from '@/components/game/modules/complete-hap';
import KnightsTourGame from '@/components/game/modules/knights-tour';
import KingmakingGame from '@/components/game/modules/kingmaking';
import TripleGomokuGame from '@/components/game/modules/triple-gomoku';
import ChoiceHoldemGame from '@/components/game/modules/choice-holdem';
import SeedSeotdaGame from '@/components/game/modules/seed-seotda';
import DoubleSidedPokerGame from '@/components/game/modules/double-sided-poker';
import MultipleBnwGame from '@/components/game/modules/multiple-bnw';
import WinningStreakGame from '@/components/game/modules/winning-streak';
import BNW2Game from '@/components/game/modules/bnw2';
import SilperBnwGame from '@/components/game/modules/silper-bnw';
import FiveTowersGame from '@/components/game/modules/five-towers';
import GrapeSugar2Game from '@/components/game/modules/grape-sugar-2';
import SunMoonStar2Game from '@/components/game/modules/sun-moon-star-2';
import BankGame from '@/components/game/modules/bank-game';

const MODULES: Record<string, ComponentType> = {
  [GAME_IDS.FOUR_GRAVITY]: FourGravityGame,
  [GAME_IDS.DOUBLE_SIDED_CHESS]: DoubleSidedChessGame,
  [GAME_IDS.NUMBER_FOUR]: NumberFourGame,
  [GAME_IDS.INDIAN_POKER]: IndianPokerGame,
  [GAME_IDS.INVEST_DONATE]: InvestDonateGame,
  [GAME_IDS.BETTING_RPS]: BettingRpsGame,
  [GAME_IDS.MULTIPLE_BNW]: MultipleBnwGame,
  [GAME_IDS.WINNING_STREAK]: WinningStreakGame,
  [GAME_IDS.BNW2]: BNW2Game,
  [GAME_IDS.SILPER_BNW]: SilperBnwGame,
  [GAME_IDS.FIVE_TOWERS]: FiveTowersGame,
  [GAME_IDS.GRAPE_SUGAR_2]: GrapeSugar2Game,
  [GAME_IDS.SUN_MOON_STAR_2]: SunMoonStar2Game,
  [GAME_IDS.BANK_GAME]: BankGame,
  [GAME_IDS.QUATRO]: QuatroGame,
  [GAME_IDS.WORD_PUZZLE]: WordPuzzleGame,
  [GAME_IDS.TRANSLETTER]: TransletterGame,
  [GAME_IDS.FORMULA_COMPLETION]: FormulaCompletionGame,
  [GAME_IDS.COMPLETE_HAP]: CompleteHapGame,
  [GAME_IDS.KNIGHTS_TOUR]: KnightsTourGame,
  [GAME_IDS.KINGMAKING]: KingmakingGame,
  [GAME_IDS.TRIPLE_GOMOKU]: TripleGomokuGame,
  [GAME_IDS.CHOICE_HOLDEM]: ChoiceHoldemGame,
  [GAME_IDS.SEED_SEOTDA]: SeedSeotdaGame,
  [GAME_IDS.DOUBLE_SIDED_POKER]: DoubleSidedPokerGame,
};

export default function UiPreview() {
  const search = useSearchParams();
  const gameId = search.get('g') ?? GAME_IDS.KINGMAKING;
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setReady(false);
    setErr(null);
    localStorage.setItem('sessionToken', 'me-token');
    fetch(`/tmp-fixtures/${gameId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`fixture 없음: ${gameId}`))))
      .then((state) => {
        useRoomStore.setState({
          room: {
            id: 'preview',
            title: gameId,
            gameId,
            gameName: gameId,
            playMode: 'multi',
            roomType: 'public',
            maxPlayers: 2,
            minPlayers: 2,
            status: 'playing',
            players: [
              { id: 'me-token', nickname: '나', isHost: true, isReady: true },
              { id: 'foe-token', nickname: '상대', isHost: false, isReady: true },
            ],
            spectators: [],
            timeLimitSeconds: 60,
            gameOptions: {},
            createdAt: Date.now(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gameState: { ...state, turnStartedAt: Date.now() } as any,
          isSpectator: false,
        });
        setReady(true);
      })
      .catch((e: Error) => setErr(e.message));
  }, [gameId]);

  const Mod = MODULES[gameId];
  if (err) return <p className="p-8 text-sm">{err}</p>;
  if (!Mod) return <p className="p-8 text-sm">모듈 없음: {gameId}</p>;
  if (!ready) return null;
  return (
    <GameShell>
      <Mod />
    </GameShell>
  );
}
