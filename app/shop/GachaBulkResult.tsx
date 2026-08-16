'use client';

import { useMemo } from 'react';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { Button } from '@/components/cdm/Button';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import { formatCdp } from '@/lib/cdp/format';
import { labelForConsumable } from '@/lib/cdp/types';
import { GRADE_ORDER } from '@/lib/gacha/constants';
import { effectPreviewColor } from '@/lib/gacha/format';
import type { GachaDrawResponse, GachaDrawResult, GachaGrade } from '@/lib/gacha/types';
import type { TitleColor } from '@/lib/supabase/database.types';
import { isTitleEffectKey } from '@shared/titles/resolve-badge';
import GachaGradeBadge from './GachaGradeBadge';

interface Props {
  response: GachaDrawResponse;
  onConfirm: () => void;
  onDrawAgain: () => void;
  drawAgainLabel: string;
  drawAgainDisabled?: boolean;
}

function prizeLine(r: GachaDrawResult) {
  const p = r.resolved;
  switch (p.kind) {
    case 'nothing':
      return <span className="text-cdm-fg-muted">꽝</span>;
    case 'cdp':
      return (
        <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-cdm-primary">
          <CdpIcon size={14} />+{formatCdp(p.amount)}
        </span>
      );
    case 'consumable':
      return (
        <span className="text-cdm-fg">
          {labelForConsumable(p.consumableKind)} <span className="text-cdm-fg-muted">×{p.qty}</span>
        </span>
      );
    case 'skin':
      return (
        <span className="text-cdm-fg">
          {p.name} <span className="text-cdm-fg-muted">7일</span>
        </span>
      );
    case 'effect':
      return (
        <span className="inline-flex items-center gap-2 text-cdm-fg">
          <TitleBadge
            name={p.name}
            color={effectPreviewColor(p.key)}
            effect={isTitleEffectKey(p.key) ? p.key : null}
            size="sm"
          />
          <span className="text-cdm-fg-muted">7일</span>
        </span>
      );
    case 'title':
    case 'legend':
      return (
        <TitleBadge
          name={p.name}
          color={p.color as TitleColor}
          effect={(p.effect as 'legend' | 'xuanwu' | 'baekho' | 'eternal' | 'issen' | null) ?? null}
          size="sm"
        />
      );
    default:
      return <span className="text-cdm-fg">{r.displayName}</span>;
  }
}

export default function GachaBulkResult({
  response,
  onConfirm,
  onDrawAgain,
  drawAgainLabel,
  drawAgainDisabled,
}: Props) {
  const { results, ticketsUsed, drawnCount, requestedCount, stoppedError } = response;

  const gradeCount = useMemo(() => {
    const m = {} as Record<GachaGrade, number>;
    for (const r of results) m[r.grade] = (m[r.grade] ?? 0) + 1;
    return m;
  }, [results]);

  const cdpGained = useMemo(
    () => results.reduce((sum, r) => sum + (r.resolved.kind === 'cdp' ? r.resolved.amount : 0), 0),
    [results],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {GRADE_ORDER.filter((g) => gradeCount[g]).map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <GachaGradeBadge grade={g} size="sm" />
            <span className="text-sm font-semibold tabular-nums text-cdm-fg">×{gradeCount[g]}</span>
          </span>
        ))}
      </div>

      <div className="rounded-lg border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2 text-xs text-cdm-fg-muted">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <span>{drawnCount}회 뽑기 완료</span>
          {ticketsUsed > 0 && <span>뽑기권 {ticketsUsed}장 사용</span>}
          {cdpGained > 0 && <span>CDP 획득 +{formatCdp(cdpGained)}</span>}
          <span>잔액 {formatCdp(response.newBalance)}</span>
        </div>
        {stoppedError && (
          <p className="mt-1 text-cdm-danger">
            {requestedCount}회 중 {drawnCount}회에서 중단 — {stoppedError}
          </p>
        )}
      </div>

      <ol className="max-h-72 overflow-y-auto rounded-lg border border-cdm-border divide-y divide-cdm-border">
        {results.map((r, i) => (
          <li key={r.drawId} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-cdm-fg-muted">
              {i + 1}
            </span>
            <GachaGradeBadge grade={r.grade} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm">{prizeLine(r)}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button fullWidth onClick={onConfirm}>
          확인
        </Button>
        <Button fullWidth variant="secondary" onClick={onDrawAgain} disabled={drawAgainDisabled}>
          {drawAgainLabel}
        </Button>
      </div>
    </div>
  );
}
