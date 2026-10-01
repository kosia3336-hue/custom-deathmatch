'use client';

import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════
 * 늘 보이는 점수 한 줄.
 *
 * 상단 메모 통합 때 여러 게임의 점수·칩이 메모 안으로 들어갔다. 라운드 기록이나
 * 상대 추리처럼 '가끔 확인하는 참고' 는 접어 두는 게 맞지만, 점수와 칩은 다르다 —
 * 몇 대 몇인지가 다음 수를 정한다. 해달별2에서 '버튼을 눌러야 상대 칩이 보인다'
 * 는 신고가 들어왔고, 같은 기준으로 훑어 보니 은행놀이·실퍼·수식완성N·
 * 컴플릿 결!합!·인디언홀덤Q 도 마찬가지였다.
 *
 * 뼈대의 info 자리에 놓는다. 한 줄이라 무대를 거의 먹지 않는다.
 * ════════════════════════════════════════════════════════════ */

export interface GameScoreEntry {
  /** 표시 이름. 본인은 '나' 로 넘긴다. */
  label: string;
  /** 점수·칩 같은 주 숫자 */
  value: React.ReactNode;
  isMe?: boolean;
  /** 선/후 등 짧은 꼬리표 */
  tag?: string;
  /** 값 뒤에 붙는 작은 보조 문구 (예: '38장') */
  hint?: string;
}

export function GameScoreLine({ entries, unit }: { entries: GameScoreEntry[]; unit?: string }) {
  return (
    <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg flex items-stretch overflow-hidden border">
      {entries.map((e, i) => (
        <div
          key={`${e.label}-${i}`}
          className={cn(
            'flex min-w-0 flex-1 items-baseline justify-between gap-1.5 px-2.5 py-1.5',
            i > 0 && 'border-cdm-border border-l',
            e.isMe && 'bg-cdm-primary-soft',
          )}
        >
          <span className="flex min-w-0 items-baseline gap-1">
            <span
              className={cn(
                'truncate text-[11px] font-bold',
                e.isMe ? 'text-cdm-primary' : 'text-cdm-fg-muted',
              )}
            >
              {e.label}
            </span>
            {e.tag && (
              <span className="text-cdm-fg-subtle shrink-0 text-[10px] font-bold">{e.tag}</span>
            )}
          </span>
          <span className="flex shrink-0 items-baseline gap-1">
            <span className="text-cdm-fg text-base leading-5 font-black tabular-nums">
              {e.value}
              {unit && <span className="ml-0.5 text-[10px] font-bold">{unit}</span>}
            </span>
            {e.hint && (
              <span className="text-cdm-fg-subtle text-[10px] font-medium tabular-nums">
                {e.hint}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
