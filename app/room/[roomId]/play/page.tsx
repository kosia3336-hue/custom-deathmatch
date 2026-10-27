'use client';

import GameLoading from '@/components/game/GameLoading';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ComponentType } from 'react';
import GameShell from '@/components/game/GameShell';
import FourGravityGame from '@/components/game/modules/four-gravity';
import DoubleSidedChessGame from '@/components/game/modules/double-sided-chess';
import NumberFourGame from '@/components/game/modules/number4';
import IndianPokerGame from '@/components/game/modules/indian-poker';
import IndianPokerEventGame from '@/components/game/modules/indian-poker-event';
import InvestDonateGame from '@/components/game/modules/invest-donate';
import BettingRpsGame from '@/components/game/modules/betting-rps';
import QuatroGame from '@/components/game/modules/quatro';
import WordPuzzleGame from '@/components/game/modules/word-puzzle';
import TransletterGame from '@/components/game/modules/transletter';
import NoVowelGame from '@/components/game/modules/no-vowel';
import JogakGame from '@/components/game/modules/jogak';
import FormulaCompletionGame from '@/components/game/modules/formula-completion';
import CompleteHapGame from '@/components/game/modules/complete-hap';
import KnightsTourGame from '@/components/game/modules/knights-tour';
import LoopCheckGame from '@/components/game/modules/loop-check';
import KingmakingGame from '@/components/game/modules/kingmaking';
import TripleGomokuGame from '@/components/game/modules/triple-gomoku';
import ChoiceHoldemGame from '@/components/game/modules/choice-holdem';
import SeedSeotdaGame from '@/components/game/modules/seed-seotda';
import DoubleSidedPokerGame from '@/components/game/modules/double-sided-poker';
import MyeongchuriGame from '@/components/game/modules/myeongchuri';
import EskimoGame from '@/components/game/modules/eskimo';
import FarewellFormulaGame from '@/components/game/modules/farewell-formula';
import MultipleBnwGame from '@/components/game/modules/multiple-bnw';
import WinningStreakGame from '@/components/game/modules/winning-streak';
import BNW2Game from '@/components/game/modules/bnw2';
import SilperBnwGame from '@/components/game/modules/silper-bnw';
import FiveTowersGame from '@/components/game/modules/five-towers';
import GrapeSugar2Game from '@/components/game/modules/grape-sugar-2';
import SunMoonStar2Game from '@/components/game/modules/sun-moon-star-2';
import SunMoonStarEventGame from '@/components/game/modules/sun-moon-star-event';
import RingTheBellGame from '@/components/game/modules/ring-the-bell';
import BankGame from '@/components/game/modules/bank-game';
import BanPickGame from '@/components/game/modules/ban-pick';
import CounterBanGame from '@/components/game/modules/counter-ban';
import GameModulePlaceholder from '@/components/game/GameModulePlaceholder';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import { GAME_IDS } from '@/shared/types';

const GAME_MODULES: Record<string, ComponentType> = {
  [GAME_IDS.FOUR_GRAVITY]: FourGravityGame,
  [GAME_IDS.DOUBLE_SIDED_CHESS]: DoubleSidedChessGame,
  [GAME_IDS.NUMBER_FOUR]: NumberFourGame,
  [GAME_IDS.INDIAN_POKER]: IndianPokerGame,
  [GAME_IDS.INDIAN_POKER_EVENT]: IndianPokerEventGame,
  [GAME_IDS.INVEST_DONATE]: InvestDonateGame,
  [GAME_IDS.BETTING_RPS]: BettingRpsGame,
  [GAME_IDS.MULTIPLE_BNW]: MultipleBnwGame,
  [GAME_IDS.WINNING_STREAK]: WinningStreakGame,
  [GAME_IDS.BNW2]: BNW2Game,
  [GAME_IDS.SILPER_BNW]: SilperBnwGame,
  [GAME_IDS.FIVE_TOWERS]: FiveTowersGame,
  [GAME_IDS.GRAPE_SUGAR_2]: GrapeSugar2Game,
  [GAME_IDS.SUN_MOON_STAR_2]: SunMoonStar2Game,
  [GAME_IDS.SUN_MOON_STAR_EVENT]: SunMoonStarEventGame,
  [GAME_IDS.RING_THE_BELL]: RingTheBellGame,
  [GAME_IDS.BANK_GAME]: BankGame,
  [GAME_IDS.QUATRO]: QuatroGame,
  [GAME_IDS.WORD_PUZZLE]: WordPuzzleGame,
  [GAME_IDS.TRANSLETTER]: TransletterGame,
  [GAME_IDS.NO_VOWEL]: NoVowelGame,
  [GAME_IDS.JOGAK]: JogakGame,
  [GAME_IDS.FORMULA_COMPLETION]: FormulaCompletionGame,
  [GAME_IDS.COMPLETE_HAP]: CompleteHapGame,
  [GAME_IDS.KNIGHTS_TOUR]: KnightsTourGame,
  [GAME_IDS.LOOP_CHECK]: LoopCheckGame,
  [GAME_IDS.KINGMAKING]: KingmakingGame,
  [GAME_IDS.TRIPLE_GOMOKU]: TripleGomokuGame,
  [GAME_IDS.CHOICE_HOLDEM]: ChoiceHoldemGame,
  [GAME_IDS.SEED_SEOTDA]: SeedSeotdaGame,
  [GAME_IDS.DOUBLE_SIDED_POKER]: DoubleSidedPokerGame,
  [GAME_IDS.MYEONGCHURI]: MyeongchuriGame,
  [GAME_IDS.ESKIMO]: EskimoGame,
  [GAME_IDS.FAREWELL_FORMULA]: FarewellFormulaGame,
  [GAME_IDS.BAN_PICK]: BanPickGame,
};

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const gameResult = useRoomStore((s) => s.gameResult);
  const gameState = useRoomStore((s) => s.gameState);
  const gameId = useRoomStore((s) => s.room?.gameId);
  const roomId_ = useRoomStore((s) => s.room?.id);
  const hiddenMatch = useRoomStore((s) => s.room?.hiddenMatch);

  /** 플레이 라우트 진입마다(대기실→플레이는 roomId 동일) 이전 판 gameResult 제거 */
  useEffect(() => {
    useRoomStore.getState().setGameResult(null);
  }, []);

  useEffect(() => {
    if (!gameResult) return;
    const timer = setTimeout(() => {
      router.push(`/room/${roomId}/result`);
    }, 3000);
    return () => clearTimeout(timer);
  }, [gameResult, roomId, router]);

  useEffect(() => {
    const socket = getSocket();
    const handleDisbanded = (data: { reason: string }) => {
      toast.info(data.reason);
      if (useRoomStore.getState().gameResult) {
        router.push(`/room/${roomId}/result`);
        return;
      }
      router.push('/lobby');
    };
    socket.on('room:disbanded', handleDisbanded);
    return () => {
      socket.off('room:disbanded', handleDisbanded);
    };
  }, [router, roomId]);

  useEffect(() => {
    getSocket().emit('game:sync');
  }, [roomId]);

  return (
    <GameShell>
      {(() => {
        const GameModule =
          gameId && roomId_ === roomId
            ? gameId === GAME_IDS.BAN_PICK && hiddenMatch
              ? CounterBanGame
              : GAME_MODULES[gameId]
            : null;
        // 밴픽·카운터 밴픽은 game:state 대신 전용 이벤트로 화면을 초기화한다.
        // 모듈을 먼저 마운트해야 해당 이벤트를 구독하고 game:sync를 요청할 수 있다.
        if (!gameId || roomId_ !== roomId) return <GameLoading />;
        if (gameId !== GAME_IDS.BAN_PICK && (!gameState || gameState.roomId !== roomId))
          return <GameLoading />;
        return GameModule ? <GameModule /> : <GameModulePlaceholder />;
      })()}
    </GameShell>
  );
}
