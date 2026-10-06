'use client';
import { BRPS_RESULTS, type BRPSResult } from '@/shared/types/betting-rps';
import { RESULT_LABELS } from './constants';
import styles from './betting-rps.module.css';
export default function ResultChoices({
  value,
  onChange,
  disabled,
}: {
  value: BRPSResult | null;
  onChange: (value: BRPSResult) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.choices} aria-label="승·무·패 선택">
      {BRPS_RESULTS.map((result) => (
        <button
          key={result}
          type="button"
          data-result={result}
          aria-pressed={value === result}
          disabled={disabled}
          onClick={() => onChange(result)}
          className={styles.choice}
        >
          {RESULT_LABELS[result]}
        </button>
      ))}
    </div>
  );
}
