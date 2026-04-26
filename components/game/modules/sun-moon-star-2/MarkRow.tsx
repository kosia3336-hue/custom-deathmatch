'use client';

import type {
  SMS2MarkId,
  SMS2PowderSubmission,
} from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, MARK_PRIORITY } from '@/shared/types/sun-moon-star-2';
import { MARK_STYLES } from './constants';

/* ════════════════════════════════════════════════════════════
 * MarkRow — 해·달·별 가로 3카드
 *   · 표식 심볼 + 우선순위
 *   · 내 누적 기여 (g) — > 0 일 때만
 *   · 점등 시 glow + scale, 비점등 dim
 *
 *   베팅 칩 정보는 FirstBetRevealBanner / MarkRevealPanel 에서
 *   전담하므로 이 컴포넌트에서는 표시하지 않음
 * ════════════════════════════════════════════════════════════ */

interface Props {
  /** 본인 누적 기여 (모든 페이즈, 플레이어만) */
  myContribution: SMS2PowderSubmission | null;
  /** 빛가루 입력 중 실시간 반영 (제출 전 미리보기) */
  pendingPowder: SMS2PowderSubmission | null;
  /** 점등된 표식 (resolve 이후) */
  litMark: SMS2MarkId | null;
  /** 점등이 결정된 이후 비점등 dim 처리 */
  dimUnlit: boolean;
  /** 카드 크기 — 'sm' (모바일), 'md' (데스크탑). 기본 'sm'. */
  size?: 'sm' | 'md';
}

export default function MarkRow({
  myContribution,
  pendingPowder,
  litMark,
  dimUnlit,
  size = 'sm',
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MARK_IDS.map((mark) => (
        <MarkCell
          key={mark}
          mark={mark}
          size={size}
          myContribution={myContribution?.[mark] ?? 0}
          pendingPowder={pendingPowder?.[mark] ?? 0}
          lit={litMark === mark}
          dim={dimUnlit && litMark !== null && litMark !== mark}
        />
      ))}
    </div>
  );
}

function MarkCell({
  mark,
  size,
  myContribution,
  pendingPowder,
  lit,
  dim,
}: {
  mark: SMS2MarkId;
  size: 'sm' | 'md';
  myContribution: number;
  pendingPowder: number;
  lit: boolean;
  dim: boolean;
}) {
  const style = MARK_STYLES[mark];

  const baseCls = lit
    ? `${style.bgLit} ${style.borderLit} ring-2 ${style.ringLit} ${style.glowLit} scale-[1.03]`
    : `${style.bgSoft} ${style.borderSoft}`;

  const dimCls = dim ? 'opacity-40 grayscale' : '';

  const myCommittedContribution = myContribution + pendingPowder;
  const textCls = lit ? style.textLit : style.textSoft;

  const sizeCls =
    size === 'md'
      ? 'min-h-[96px] px-2 py-2.5'
      : 'min-h-[80px] px-1 py-2';
  const iconCls = size === 'md' ? 'text-3xl' : 'text-2xl';
  const labelCls = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <div
      className={`relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 transition-all duration-300 ${sizeCls} ${baseCls} ${dimCls}`}
      aria-label={`${style.label}, 우선순위 ${MARK_PRIORITY[mark]}, 내 누적 ${myCommittedContribution}g`}
    >
      {/* 우선순위 배지 */}
      <span className="absolute left-1 top-1 rounded-full bg-white/70 px-1 py-0 text-[8px] font-bold text-gray-500">
        #{MARK_PRIORITY[mark]}
      </span>

      {/* 점등 배지 */}
      {lit && (
        <span className="absolute right-1 top-1 rounded-full bg-amber-500 px-1 py-0 text-[8px] font-bold text-white">
          점등
        </span>
      )}

      {/* 심볼 + 라벨 */}
      <div className={`flex items-center gap-1 ${lit ? 'animate-pulse' : ''}`}>
        <span className={`${iconCls} leading-none`}>{style.icon}</span>
        <span className={`${labelCls} font-bold ${textCls}`}>{style.label}</span>
      </div>

      {/* 내 누적 기여 — 실제 값 있을 때만 */}
      {myCommittedContribution > 0 && (
        <div className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.chipSelf}`}>
          내 {myCommittedContribution}g
          {pendingPowder > 0 && (
            <span className="ml-0.5 text-[9px] opacity-70">(+{pendingPowder})</span>
          )}
        </div>
      )}
    </div>
  );
}
