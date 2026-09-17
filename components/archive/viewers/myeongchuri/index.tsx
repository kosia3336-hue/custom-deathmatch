'use client';

import { Card } from '@/components/cdm/Card';
import { cn } from '@/lib/utils';
import { myeongchuriTileToken } from '@/shared/logic/myeongchuri';
import type { GameRecordFile } from '@/shared/types/archive';
import {
  MYEONGCHURI_LETTERS,
  type MyeongchuriArchiveRecord,
  type MyeongchuriRoundResult,
} from '@/shared/types/myeongchuri';

const HIDDEN_LABEL: Record<string, string> = {
  numbers: '비공개 (숫자 3개 이상)',
  symbols: '비공개 (기호 3개 이상)',
};

function roundResultLabel(round: MyeongchuriRoundResult) {
  return round.value ?? (round.hidden ? HIDDEN_LABEL[round.hidden] : '비공개');
}

/** 명추리 기록 — 게임이 끝나 공개된 타일, 라운드별 수식·결과, 명추리 선언. */
export default function MyeongchuriViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as MyeongchuriArchiveRecord | null;
  if (!data?.tiles || !Array.isArray(data.rounds)) {
    return <p className="text-cdm-fg-muted text-sm">명추리 기록을 읽을 수 없습니다.</p>;
  }
  const name = (id: string) => data.players[id]?.nickname ?? '플레이어';
  const winner = data.winnerId ? name(data.winnerId) : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">MYEONGCHURI</p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
          </div>
          <p className="text-cdm-primary text-lg font-black">{winner ? `${winner} 승리` : '게임 종료'}</p>
        </div>
        <div className="text-cdm-fg-muted mt-3 flex flex-wrap gap-4 text-xs">
          {Object.keys(data.players).map((id) => (
            <span key={id}>
              <span className="text-cdm-fg font-bold">{name(id)}</span> · 경고{' '}
              <span className="tabular-nums">{data.warnings[id] ?? 0}</span>
            </span>
          ))}
          <span>생각 시간 {data.thinkEnabled ? `${Math.round(data.thinkSeconds / 60)}분` : '끔'}</span>
        </div>
      </Card>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Card className="p-3">
          <p className="text-cdm-fg text-sm font-black">타일 공개</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {MYEONGCHURI_LETTERS.map((letter) => (
              <div
                key={letter}
                className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-md flex aspect-square flex-col items-center justify-center border"
              >
                <span className="text-cdm-fg-subtle text-[11px] font-bold">{letter}</span>
                <span className="text-cdm-fg text-lg font-black">{myeongchuriTileToken(data.tiles[letter])}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <p className="text-cdm-fg text-sm font-black">라운드 기록</p>
          <ul className="mt-2 max-h-[28rem] space-y-1 overflow-y-auto text-xs">
            {data.rounds.map((round) => (
              <li key={round.round} className="bg-cdm-bg-elev-1 rounded-cdm-md px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-cdm-fg font-bold">
                    {round.round}R · 선 {name(round.firstPlayerId)}
                  </span>
                  <span className={cn('font-black tabular-nums', round.value == null ? 'text-cdm-fg-muted' : 'text-cdm-primary')}>
                    {roundResultLabel(round)}
                  </span>
                </div>
                <p className="text-cdm-fg-muted mt-0.5">
                  {round.letters.join('')}
                  {'  →  '}
                  {round.letters.map((letter) => myeongchuriTileToken(data.tiles[letter])).join(' ')}
                  {(round.randomFirst || round.randomSecond) && ' · 시간 초과로 무작위 배치'}
                </p>
              </li>
            ))}
          </ul>
          {data.declarations.length > 0 && (
            <>
              <p className="text-cdm-fg mt-3 text-sm font-black">명추리</p>
              <ul className="mt-1 space-y-1 text-xs">
                {data.declarations.map((entry, index) => (
                  <li key={index} className="text-cdm-fg-muted">
                    {entry.round}R · <b className="text-cdm-fg">{name(entry.playerId)}</b>{' '}
                    {entry.success ? '성공' : entry.timedOut ? '실패 (제출 시간 초과)' : '실패'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
