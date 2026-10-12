import { ESKIMO_BEAR_LOCK_TURNS } from '@/shared/types/eskimo';
import styles from './eskimo-board.module.css';

/** Four turns recharge the bear's movement; a full pink bar means it can move again. */
export function EskimoBearStatus({ lockTurns }: { lockTurns: number }) {
  const remaining = Math.min(ESKIMO_BEAR_LOCK_TURNS, Math.max(0, lockTurns));
  const ready = ESKIMO_BEAR_LOCK_TURNS - remaining;
  const label = remaining ? `${remaining}턴 뒤 이동 가능` : '이동 가능';
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-bold tabular-nums">
      <span
        role="meter"
        aria-label="북극곰 이동 준비"
        aria-valuemin={0}
        aria-valuemax={ESKIMO_BEAR_LOCK_TURNS}
        aria-valuenow={ready}
        aria-valuetext={label}
        className={styles.bearMeter}
      >
        {Array.from({ length: ESKIMO_BEAR_LOCK_TURNS }, (_, index) => (
          <span
            key={index}
            aria-hidden
            className={styles.bearSegment}
            data-filled={index < ready}
          />
        ))}
      </span>
      <span className={remaining ? 'text-cdm-fg-muted' : 'text-cdm-primary'}>{label}</span>
    </span>
  );
}
