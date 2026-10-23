'use client';
import type { GameRecordFile } from '@/shared/types/archive';
import type { LoopCheckArchiveRecord } from '@/shared/types/loop-check';
import LoopCheckBoard from '@/components/game/modules/loop-check/LoopCheckBoard';

export default function LoopCheckViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as LoopCheckArchiveRecord | null;
  if (!data || !Array.isArray(data.history)) return <p>루프체크 기록을 읽을 수 없습니다.</p>;
  return (
    <div className="space-y-5">
      <p className="text-sm font-bold">
        {data.bestOf}전 {data.winScore}선승 ·{' '}
        {Object.entries(data.finalScores)
          .map(([id, score]) => `${data.players[id]?.nickname ?? '플레이어'} ${score}점`)
          .join(' : ')}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.history.map((round, index) => (
          <section key={index} className="border-cdm-border rounded-xl border p-3">
            <p className="mb-2 text-xs font-bold">
              {round.round}R ·{' '}
              {round.winnerId
                ? `${data.players[round.winnerId]?.nickname ?? '플레이어'} +1점`
                : '시간 종료'}
            </p>
            <LoopCheckBoard board={round.board} path={round.path} colorMode={data.colorMode} />
          </section>
        ))}
      </div>
    </div>
  );
}
