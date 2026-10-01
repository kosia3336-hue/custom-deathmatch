'use client';

import { DesktopTable } from './DesktopTable';
import { PlayDock } from './PlayDock';
import type { PlayViewProps } from './play-view';
import styles from './desktop-table.module.css';

export default function DesktopLayout(props: PlayViewProps) {
  return (
    <div className="bg-cdm-bg relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <DesktopTable {...props} />
      {props.state.roster.some((p) => p.id === props.meId) && <PlayDock {...props} />}
      {props.flash && (
        <div className={styles.flash} role="status">
          <p className={styles.flashCard}>{props.flash}</p>
        </div>
      )}
    </div>
  );
}
