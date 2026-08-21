import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import { Card } from '@/components/cdm/Card';
import { cn } from '@/lib/utils';

interface Props {
  gameData: FormulaCompletionGameData;
  myId: string;
  className?: string;
}

export default function RoundReveal({ gameData, myId, className }: Props) {
  const result = gameData.lastResult;
  if (!result) return null;

  const caller = result.callerId ? gameData.players[result.callerId] : null;
  const isCorrect = result.outcome === 'correct';
  const isTimeout = result.outcome === 'timeout';
  const title = isTimeout
    ? '시간 종료'
    : isCorrect
      ? `${caller?.nickname ?? '플레이어'} 정답!`
      : `${caller?.nickname ?? '플레이어'} 오답`;

  return (
    <Card
      variant="highlight"
      accent={isCorrect ? 'primary' : isTimeout ? 'highlight' : 'accent'}
      className={cn('text-center', className)}
      role="status"
    >
      <p className={cn(
        'text-lg font-extrabold',
        isCorrect ? 'text-cdm-primary' : isTimeout ? 'text-cdm-highlight' : 'text-cdm-accent',
      )}>
        {title}
        {result.callerId === myId ? ' (나)' : ''}
      </p>
      {!isTimeout && result.expression && (
        <div className="mt-3 rounded-cdm-md bg-cdm-bg-elev-1 px-3 py-2">
          <p className="break-all font-mono text-base font-bold text-cdm-fg">{result.expression}</p>
          <p className="mt-1 text-xs text-cdm-fg-muted">
            {result.reason} · {result.scoreDelta > 0 ? '+1점' : '-1점'}
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-cdm-fg-muted">
        예시 해답 <span className="font-mono font-semibold text-cdm-fg">{result.solution}</span>
      </p>
      <p className="mt-2 text-[11px] text-cdm-fg-subtle">잠시 후 다음 라운드로 넘어갑니다.</p>
    </Card>
  );
}
