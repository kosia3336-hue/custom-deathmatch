'use client';

import type { ComponentType } from 'react';
import type { GameRecordFile } from '@/shared/types/archive';
import QuatroViewer from './viewers/quatro';
import { GAME_IDS } from '@/shared/types';

import FourGravityViewer from '@/components/archive/viewers/four-gravity/FourGravityViewer';
import DoubleSidedChessViewer from '@/components/archive/viewers/double-sided-chess/DoubleSidedChessViewer';
import Number4Viewer from '@/components/archive/viewers/number4/Number4Viewer';
import IndianPokerViewer from '@/components/archive/viewers/indian-poker/IndianPokerViewer';
import InvestDonateViewer from '@/components/archive/viewers/invest-donate/InvestDonateViewer';
import BettingRpsViewer from '@/components/archive/viewers/betting-rps/BettingRpsViewer';
import MultipleBnwViewer from '@/components/archive/viewers/multiple-bnw';
import WinningStreakViewer from '@/components/archive/viewers/winning-streak';
import BNW2Viewer from '@/components/archive/viewers/bnw2';
import SilperBnwViewer from '@/components/archive/viewers/silper-bnw';
import FiveTowersViewer from '@/components/archive/viewers/five-towers';
import GrapeSugar2Viewer from '@/components/archive/viewers/grape-sugar-2';
import SunMoonStar2Viewer from '@/components/archive/viewers/sun-moon-star-2';
import BankGameViewer from '@/components/archive/viewers/bank-game';
import FormulaCompletionViewer from '@/components/archive/viewers/formula-completion';

export const VIEWER_MAP: Record<string, ComponentType<{ record: GameRecordFile }>> = {
  [GAME_IDS.FOUR_GRAVITY]: FourGravityViewer,
  [GAME_IDS.DOUBLE_SIDED_CHESS]: DoubleSidedChessViewer,
  [GAME_IDS.NUMBER_FOUR]: Number4Viewer,
  [GAME_IDS.INDIAN_POKER]: IndianPokerViewer,
  [GAME_IDS.INVEST_DONATE]: InvestDonateViewer,
  [GAME_IDS.BETTING_RPS]: BettingRpsViewer,
  [GAME_IDS.MULTIPLE_BNW]: MultipleBnwViewer,
  [GAME_IDS.WINNING_STREAK]: WinningStreakViewer,
  [GAME_IDS.BNW2]: BNW2Viewer,
  [GAME_IDS.SILPER_BNW]: SilperBnwViewer,
  [GAME_IDS.FIVE_TOWERS]: FiveTowersViewer,
  [GAME_IDS.GRAPE_SUGAR_2]: GrapeSugar2Viewer,
  [GAME_IDS.SUN_MOON_STAR_2]: SunMoonStar2Viewer,
  [GAME_IDS.BANK_GAME]: BankGameViewer,
  [GAME_IDS.QUATRO]: QuatroViewer,
  [GAME_IDS.FORMULA_COMPLETION]: FormulaCompletionViewer,
};

export default function LogViewer({ record }: { record: GameRecordFile }) {
  const Viewer = VIEWER_MAP[record.gameId];
  if (!Viewer) {
    return (
      <pre className="overflow-x-auto text-xs text-cdm-fg-muted">
        {JSON.stringify(record, null, 2)}
      </pre>
    );
  }
  return <Viewer record={record} />;
}
