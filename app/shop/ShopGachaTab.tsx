'use client';

import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { formatCdp } from '@/lib/cdp/format';
import { CdpIcon } from '@/components/cdm/CdpIcon';
import { GACHA_PRICE_CDP, GRADE_ORDER, GRADE_WEIGHTS } from '@/lib/gacha/constants';
import { useInventoryStore } from '@/stores/inventory';

interface Props {
  balance: number;
  onOpen: () => void;
}

/*
  확률표는 GRADE_WEIGHTS 에서 그대로 뽑는다. 예전에는 값을 여기 적어 두어서
  가중치를 바꾸면 표시와 실제가 조용히 어긋났다(B 를 8% 로 올렸는데 표는 4%).
*/
const WEIGHT_SUM = Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0);
const SUMMARY_CHIPS = GRADE_ORDER.map((g) => ({
  label: g,
  // S 가 0.02% 라 소수 둘째 자리까지 둔다(첫째 자리면 0% 로 보인다).
  rate: `${Number(((GRADE_WEIGHTS[g] / WEIGHT_SUM) * 100).toFixed(2))}%`,
}));

export default function ShopGachaTab({ balance, onOpen }: Props) {
  const ticketCount = useInventoryStore((st) => st.items?.gacha_ticket ?? 0);
  // 뽑기권이 있으면 CDP 가 부족해도 모달을 열 수 있어야 한다
  const insufficient = balance < GACHA_PRICE_CDP && ticketCount < 1;

  return (
    <section className="mx-auto w-full max-w-lg">
      <Card variant="highlight" accent="primary" className="flex flex-col gap-4 p-4! sm:p-6!">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="mx-auto flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-cdm-primary/15 sm:mx-0"
            aria-hidden
          >
            <CdpIcon size={44} />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-cdm-fg">CDP 뽑기</h2>
            <p className="mt-1 text-sm text-cdm-fg-muted">
              운을 시험해 보세요. {formatCdp(GACHA_PRICE_CDP)} CDP로 1회 뽑기.
            </p>
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cdm-fg">
              <CdpIcon size={16} />
              {formatCdp(GACHA_PRICE_CDP)} / 1회
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
            ? `뽑기 (${formatCdp(GACHA_PRICE_CDP - balance)} 부족)`
            : ticketCount > 0
              ? `뽑기하기 (뽑기권 ${ticketCount}장 보유)`
              : '뽑기하기'}
        </Button>
      </Card>
    </section>
  );
}
