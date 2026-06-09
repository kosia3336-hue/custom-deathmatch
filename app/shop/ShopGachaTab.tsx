'use client';

import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { CDP_ICON, formatCdp } from '@/lib/cdp/format';
import { GACHA_PRICE_CDP } from '@/lib/gacha/constants';

interface Props {
  balance: number;
  onOpen: () => void;
}

const SUMMARY_CHIPS = [
  { label: 'S', rate: '0.8%' },
  { label: 'A', rate: '1.5%' },
  { label: 'B', rate: '4%' },
  { label: 'C', rate: '28%' },
  { label: 'F', rate: '65.7%' },
];

export default function ShopGachaTab({ balance, onOpen }: Props) {
  const insufficient = balance < GACHA_PRICE_CDP;

  return (
    <section className="mx-auto w-full max-w-lg">
      <Card variant="highlight" accent="primary" className="flex flex-col gap-4 p-4! sm:p-6!">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="mx-auto flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-cdm-primary/15 text-4xl sm:mx-0"
            aria-hidden
          >
            🎲
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-cdm-fg">CDP 뽑기</h2>
            <p className="mt-1 text-sm text-cdm-fg-muted">
              운을 시험해 보세요. {formatCdp(GACHA_PRICE_CDP)} CDP로 1회 뽑기.
            </p>
            <p className="mt-2 text-sm font-semibold text-cdm-fg">
              {CDP_ICON} {formatCdp(GACHA_PRICE_CDP)} / 1회
            </p>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
          {SUMMARY_CHIPS.map((c) => (
            <span
              key={c.label}
              className="shrink-0 snap-start rounded-full border border-cdm-border bg-cdm-bg-elev-1 px-2 py-0.5 text-[11px] tabular-nums text-cdm-fg-muted"
            >
              <strong className="text-cdm-fg">{c.label}</strong> {c.rate}
            </span>
          ))}
        </div>

        <Button fullWidth disabled={insufficient} onClick={onOpen}>
          {insufficient
            ? `🎲 뽑기 (${formatCdp(GACHA_PRICE_CDP - balance)} 부족)`
            : '🎲 뽑기하기'}
        </Button>
      </Card>
    </section>
  );
}
