'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ComponentType } from 'react';
import GNB from '@/components/layout/GNB';
import { useArchiveStore } from '@/stores/archive';
import type { GameRecordFile } from '@/shared/types/archive';
import { GAME_IDS } from '@/shared/types';
import FourGravityViewer from '@/components/archive/viewers/four-gravity/FourGravityViewer';
import DoubleSidedChessViewer from '@/components/archive/viewers/double-sided-chess/DoubleSidedChessViewer';
import Number4Viewer from '@/components/archive/viewers/number4/Number4Viewer';
import IndianPokerViewer from '@/components/archive/viewers/indian-poker/IndianPokerViewer';
import InvestDonateViewer from '@/components/archive/viewers/invest-donate/InvestDonateViewer';
import BettingRpsViewer from '@/components/archive/viewers/betting-rps/BettingRpsViewer';
import MultipleBnwViewer from '@/components/archive/viewers/multiple-bnw';
import Link from 'next/link';

const VIEWER_MAP: Record<string, ComponentType<{ record: GameRecordFile }>> = {
  [GAME_IDS.FOUR_GRAVITY]: FourGravityViewer,
  [GAME_IDS.DOUBLE_SIDED_CHESS]: DoubleSidedChessViewer,
  [GAME_IDS.NUMBER_FOUR]: Number4Viewer,
  [GAME_IDS.INDIAN_POKER]: IndianPokerViewer,
  [GAME_IDS.INVEST_DONATE]: InvestDonateViewer,
  [GAME_IDS.BETTING_RPS]: BettingRpsViewer,
  [GAME_IDS.MULTIPLE_BNW]: MultipleBnwViewer,
};

export default function ArchiveViewPage() {
  const router = useRouter();
  const record = useArchiveStore((s) => s.record);

  useEffect(() => {
    if (!record) {
      toast.error('기록 파일을 다시 업로드해주세요.');
      router.replace('/archive');
    }
  }, [record, router]);

  if (!record) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <GNB />

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <Link
          href="/archive"
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← 다른 기록 열기
        </Link>

        {(() => {
          const Viewer = VIEWER_MAP[record.gameId];
          if (Viewer) return <Viewer record={record} />;
          return (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
              <p className="mb-4 text-gray-500">이 게임의 뷰어는 아직 준비되지 않았습니다.</p>
              <pre className="mx-auto max-h-96 max-w-2xl overflow-auto rounded bg-gray-50 p-4 text-left text-xs text-gray-600">
                {JSON.stringify(record, null, 2)}
              </pre>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
